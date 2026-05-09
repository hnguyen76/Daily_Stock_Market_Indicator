const DATA = window.MARKET_DATA;

const COLORS = [
  "#2563eb",
  "#0f9f8f",
  "#c98211",
  "#ca3f3a",
  "#7657c8",
  "#258a55",
  "#d15f8f",
  "#2f7f9f",
  "#7a6a22",
  "#475569",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const state = {
  selected: [],
  horizon: "all",
  metric: "normalizedClose",
  heatmapIndex: "",
  sortKey: "opportunityScore",
  sortDirection: "desc",
};

function $(selector) {
  return document.querySelector(selector);
}

function createSvgElement(tag, attrs = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatPct(value, digits = 2) {
  if (value === null || Number.isNaN(Number(value))) return "n/a";
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

function formatPctPoint(value, digits = 2) {
  if (value === null || Number.isNaN(Number(value))) return "n/a";
  return `${Number(value).toFixed(digits)}%`;
}

function shortIndexName(name) {
  return name
    .replace(" Composite", "")
    .replace("SSE ", "SSE")
    .replace("NASDAQ", "Nasdaq");
}

function colorForIndex(name) {
  const names = Object.keys(DATA.series);
  return COLORS[names.indexOf(name) % COLORS.length];
}

function scoreColor(score) {
  if (score >= 70) return "#258a55";
  if (score >= 55) return "#c98211";
  return "#ca3f3a";
}

function regimeColor(regime) {
  if (regime === "Momentum leader") return "#258a55";
  if (regime === "Constructive") return "#0f9f8f";
  if (regime === "Risk watch") return "#ca3f3a";
  return "#627084";
}

function getSummary(index) {
  return DATA.summary.find((row) => row.index === index);
}

function filteredSeries(index) {
  const series = DATA.series[index];
  const horizon = state.horizon === "all" ? series.dates.length : Number(state.horizon);
  const start = Math.max(0, series.dates.length - horizon);
  return {
    dates: series.dates.slice(start),
    values: series[state.metric].slice(start),
  };
}

function extent(values, paddingRatio = 0.08) {
  const valid = values.filter((value) => value !== null && Number.isFinite(Number(value)));
  if (!valid.length) return [0, 1];
  let min = Math.min(...valid);
  let max = Math.max(...valid);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const padding = (max - min) * paddingRatio;
  return [min - padding, max + padding];
}

function scaleLinear(domainMin, domainMax, rangeMin, rangeMax) {
  return (value) => {
    if (domainMax === domainMin) return (rangeMin + rangeMax) / 2;
    return rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
  };
}

function updateKpis() {
  $("#dataset-window").textContent = `${DATA.meta.startDate} to ${DATA.meta.endDate}`;
  $("#kpi-rows").textContent = formatNumber(DATA.meta.rows);
  $("#kpi-markets").textContent = formatNumber(DATA.meta.indexes);
  $("#kpi-countries").textContent = formatNumber(DATA.meta.countries);
  $("#kpi-quality").textContent = DATA.meta.closeVolAnnualizedMedian > 1 ? "Flagged" : "Clean";
  $("#kpi-quality-note").textContent = DATA.meta.missingValues === 0 ? "0 missing values" : `${DATA.meta.missingValues} missing`;
}

function buildControls() {
  const sorted = [...DATA.summary].sort((a, b) => b.opportunityScore - a.opportunityScore);
  state.selected = sorted.slice(0, 5).map((row) => row.index);
  state.heatmapIndex = sorted[0].index;

  const chipWrap = $("#index-chips");
  chipWrap.innerHTML = "";
  DATA.summary.forEach((row) => {
    const label = document.createElement("label");
    label.className = "chip";
    label.style.borderColor = colorForIndex(row.index);
    label.innerHTML = `
      <input type="checkbox" value="${row.index}" ${state.selected.includes(row.index) ? "checked" : ""} />
      <span>${shortIndexName(row.index)}</span>
    `;
    chipWrap.appendChild(label);
  });

  chipWrap.addEventListener("change", (event) => {
    if (event.target.type !== "checkbox") return;
    const checked = [...chipWrap.querySelectorAll("input:checked")].map((input) => input.value);
    state.selected = checked.length ? checked : [event.target.value];
    if (!checked.length) event.target.checked = true;
    renderAll();
  });

  $("#horizon-controls").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    state.horizon = button.dataset.horizon;
    $("#horizon-controls").querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderAll();
  });

  $("#metric-controls").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    state.metric = button.dataset.metric;
    $("#metric-controls").querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderAll();
  });

  const heatmapSelect = $("#heatmap-index");
  heatmapSelect.innerHTML = DATA.summary
    .map((row) => `<option value="${row.index}">${row.index}</option>`)
    .join("");
  heatmapSelect.value = state.heatmapIndex;
  heatmapSelect.addEventListener("change", () => {
    state.heatmapIndex = heatmapSelect.value;
    renderHeatmap();
  });

  document.querySelectorAll("th[data-sort]").forEach((header) => {
    header.addEventListener("click", () => {
      const key = header.dataset.sort;
      if (state.sortKey === key) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDirection = key === "index" || key === "country" || key === "regime" ? "asc" : "desc";
      }
      renderScoreboard();
    });
  });
}

function drawGrid(svg, width, height, margin, yTicks, yScale, formatter) {
  const plotWidth = width - margin.left - margin.right;
  yTicks.forEach((tick) => {
    const y = yScale(tick);
    svg.appendChild(
      createSvgElement("line", {
        x1: margin.left,
        y1: y,
        x2: width - margin.right,
        y2: y,
        class: "grid-line",
      }),
    );
    const label = createSvgElement("text", {
      x: margin.left - 10,
      y: y + 4,
      "text-anchor": "end",
      class: "axis-label",
    });
    label.textContent = formatter(tick);
    svg.appendChild(label);
  });
  svg.appendChild(
    createSvgElement("line", {
      x1: margin.left,
      y1: height - margin.bottom,
      x2: margin.left + plotWidth,
      y2: height - margin.bottom,
      class: "axis-line",
    }),
  );
}

function renderLineChart() {
  const svg = $("#line-chart");
  svg.innerHTML = "";
  const box = svg.getBoundingClientRect();
  const width = Math.max(620, box.width || 800);
  const height = Math.max(300, box.height || 430);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const margin = { top: 18, right: 28, bottom: 38, left: 56 };
  const datasets = state.selected.map((index) => ({
    index,
    ...filteredSeries(index),
  }));
  const allValues = datasets.flatMap((item) => item.values);
  const [yMin, yMax] = extent(state.metric === "normalizedClose" ? allValues.concat([100]) : allValues);
  const maxPoints = Math.max(...datasets.map((item) => item.values.length));
  const xScale = scaleLinear(0, Math.max(maxPoints - 1, 1), margin.left, width - margin.right);
  const yScale = scaleLinear(yMin, yMax, height - margin.bottom, margin.top);
  const ticks = Array.from({ length: 5 }, (_, index) => yMin + ((yMax - yMin) / 4) * index);
  const formatter = state.metric === "normalizedClose" ? (value) => formatNumber(value, 0) : (value) => `${value.toFixed(1)}%`;

  drawGrid(svg, width, height, margin, ticks, yScale, formatter);

  datasets.forEach((dataset) => {
    const points = dataset.values
      .map((value, index) => ({ value, index }))
      .filter((point) => point.value !== null && Number.isFinite(Number(point.value)));

    if (!points.length) return;
    const path = points
      .map((point, position) => {
        const command = position === 0 ? "M" : "L";
        return `${command}${xScale(point.index).toFixed(1)},${yScale(point.value).toFixed(1)}`;
      })
      .join(" ");

    svg.appendChild(
      createSvgElement("path", {
        d: path,
        class: "line-path",
        stroke: colorForIndex(dataset.index),
      }),
    );
  });

  const firstDataset = datasets[0];
  if (firstDataset && firstDataset.dates.length) {
    const start = createSvgElement("text", {
      x: margin.left,
      y: height - 12,
      class: "axis-label",
    });
    start.textContent = firstDataset.dates[0];
    svg.appendChild(start);

    const end = createSvgElement("text", {
      x: width - margin.right,
      y: height - 12,
      "text-anchor": "end",
      class: "axis-label",
    });
    end.textContent = firstDataset.dates[firstDataset.dates.length - 1];
    svg.appendChild(end);
  }

  const wrap = svg.parentElement;
  const oldLegend = wrap.querySelector(".legend");
  if (oldLegend) oldLegend.remove();
  const legend = document.createElement("div");
  legend.className = "legend";
  state.selected.forEach((index) => {
    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-swatch" style="background:${colorForIndex(index)}"></span>${shortIndexName(index)}`;
    legend.appendChild(item);
  });
  wrap.appendChild(legend);

  $("#trend-title").textContent =
    state.metric === "normalizedClose" ? "Rebased price performance" : "30D average daily change";
  $("#trend-subtitle").textContent =
    state.metric === "normalizedClose" ? "Close indexed to 100" : "Percent points";
}

function renderScatter() {
  const svg = $("#scatter-chart");
  svg.innerHTML = "";
  const box = svg.getBoundingClientRect();
  const width = Math.max(420, box.width || 520);
  const height = Math.max(260, box.height || 276);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const margin = { top: 22, right: 24, bottom: 42, left: 50 };
  const xs = DATA.summary.map((row) => row.avgChange90D);
  const ys = DATA.summary.map((row) => row.vol90D);
  const [xMin, xMax] = extent(xs, 0.18);
  const [yMin, yMax] = extent(ys, 0.18);
  const xScale = scaleLinear(xMin, xMax, margin.left, width - margin.right);
  const yScale = scaleLinear(yMin, yMax, height - margin.bottom, margin.top);

  drawGrid(svg, width, height, margin, [yMin, (yMin + yMax) / 2, yMax], yScale, (value) => formatPct(value, 1));

  [xMin, (xMin + xMax) / 2, xMax].forEach((tick) => {
    const x = xScale(tick);
    const label = createSvgElement("text", {
      x,
      y: height - 14,
      "text-anchor": "middle",
      class: "axis-label",
    });
    label.textContent = formatPct(tick, 1);
    svg.appendChild(label);
  });

  DATA.summary.forEach((row) => {
    const radius = 6 + (row.opportunityScore / 100) * 9;
    svg.appendChild(
      createSvgElement("circle", {
        cx: xScale(row.avgChange90D),
        cy: yScale(row.vol90D),
        r: radius.toFixed(1),
        fill: colorForIndex(row.index),
        class: "scatter-dot",
        opacity: state.selected.includes(row.index) ? "0.95" : "0.38",
      }),
    );
    const label = createSvgElement("text", {
      x: xScale(row.avgChange90D) + radius + 4,
      y: yScale(row.vol90D) + 4,
      class: "chart-label",
      opacity: state.selected.includes(row.index) ? "1" : "0.45",
    });
    label.textContent = shortIndexName(row.index);
    svg.appendChild(label);
  });
}

function heatColor(value) {
  const abs = Math.min(Math.abs(value) / 3, 1);
  if (value > 0.15) {
    return `rgba(37, 138, 85, ${0.38 + abs * 0.62})`;
  }
  if (value < -0.15) {
    return `rgba(202, 63, 58, ${0.38 + abs * 0.62})`;
  }
  return `rgba(98, 112, 132, ${0.38 + abs * 0.45})`;
}

function renderHeatmap() {
  const wrap = $("#heatmap");
  const rows = DATA.monthlyHeatmap.filter((row) => row.index === state.heatmapIndex);
  wrap.innerHTML = "";
  rows.forEach((row) => {
    const cell = document.createElement("div");
    const monthNumber = Number(row.month.slice(5, 7)) - 1;
    cell.className = "heat-cell";
    cell.style.background = heatColor(row.avgChange);
    cell.title = `${row.month}: ${formatPctPoint(row.avgChange)}`;
    cell.textContent = `${MONTHS[monthNumber]} ${formatPctPoint(row.avgChange, 1)}`;
    wrap.appendChild(cell);
  });
  $("#heatmap-label").textContent = state.heatmapIndex;
}

function renderBriefs() {
  const leaders = [...DATA.summary].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 3);
  const risks = [...DATA.summary].sort((a, b) => a.tailRisk5Pct - b.tailRisk5Pct).slice(0, 3);

  $("#leader-list").innerHTML = leaders
    .map(
      (row) => `
      <div class="brief-item">
        <strong><span>${row.index}</span><span>${row.opportunityScore.toFixed(1)}</span></strong>
        <span>${row.regime} | 90D avg ${formatPct(row.avgChange90D)} | win rate ${formatPct(row.winRate90D)}</span>
      </div>
    `,
    )
    .join("");

  $("#risk-list").innerHTML = risks
    .map(
      (row) => `
      <div class="brief-item">
        <strong><span>${row.index}</span><span>${formatPct(row.tailRisk5Pct)}</span></strong>
        <span>5% daily tail | worst day ${formatPct(row.worstDay)} | 90D vol ${formatPct(row.vol90D)}</span>
      </div>
    `,
    )
    .join("");
}

function renderScoreboard() {
  const rows = [...DATA.summary].sort((a, b) => {
    const aValue = a[state.sortKey];
    const bValue = b[state.sortKey];
    let result;
    if (typeof aValue === "number" && typeof bValue === "number") {
      result = aValue - bValue;
    } else {
      result = String(aValue).localeCompare(String(bValue));
    }
    return state.sortDirection === "asc" ? result : -result;
  });

  $("#scoreboard-body").innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td><strong>${row.index}</strong></td>
        <td>${row.country}</td>
        <td><span class="score-pill" style="background:${scoreColor(row.opportunityScore)}">${row.opportunityScore.toFixed(1)}</span></td>
        <td>${formatPct(row.avgChange90D)}</td>
        <td>${formatPct(row.winRate90D)}</td>
        <td>${formatPct(row.volumeTrend)}</td>
        <td>${formatPct(row.tailRisk5Pct)}</td>
        <td><span class="regime-pill" style="background:${regimeColor(row.regime)}">${row.regime}</span></td>
      </tr>
    `,
    )
    .join("");
}

function renderAll() {
  renderLineChart();
  renderScatter();
  renderHeatmap();
  renderBriefs();
  renderScoreboard();
}

function init() {
  updateKpis();
  buildControls();
  renderAll();
  window.addEventListener("resize", () => {
    renderLineChart();
    renderScatter();
  });
}

init();
