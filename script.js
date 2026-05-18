const RESULTS_API_URL = "https://script.google.com/macros/s/AKfycbyby7nOGMZe-w8pph0IZ7jz9WqQ17pwFhfW4TdWgoi1PJlkvXhYuNzHav48WBNsOkcGjg/exec";
const REFRESH_INTERVAL_MS = 60 * 1000;

const TARGETS = {
  overall: 170,
  fullRack: 170,
  halfRack: 200,
  ea: 170,
};

const CATEGORY_CONFIG = [
  {
    key: "fullRack",
    title: "Picking Productivity - Full Rack (หยิบ)",
    shortTitle: "Full Rack",
    mainKpi: "37%",
    target: TARGETS.fullRack,
  },
  {
    key: "halfRack",
    title: "Picking Productivity - Half Rack (หยิบ)",
    shortTitle: "Half Rack",
    mainKpi: "48%",
    target: TARGETS.halfRack,
  },
  {
    key: "ea",
    title: "Picking Productivity - EA (หยิบ)",
    shortTitle: "EA",
    mainKpi: "15%",
    target: TARGETS.ea,
  },
];

const refreshButton = document.querySelector("#refreshButton");
const syncStatus = document.querySelector("#syncStatus");
const startDateInput = document.querySelector("#startDate");
const endDateInput = document.querySelector("#endDate");
const applyDateButton = document.querySelector("#applyDateButton");
const quickFilterButtons = document.querySelectorAll(".chip[data-range]");

const overallCard = document.querySelector("#overallCard");
const overallAverage = document.querySelector("#overallAverage");
const overallStatus = document.querySelector("#overallStatus");
const overallGap = document.querySelector("#overallGap");
const overallProgress = document.querySelector("#overallProgress");
const validRows = document.querySelector("#validRows");
const totalRows = document.querySelector("#totalRows");
const excludedRows = document.querySelector("#excludedRows");
const categoryGrid = document.querySelector("#categoryGrid");
const barChart = document.querySelector("#barChart");
const chartNote = document.querySelector("#chartNote");
const excludedTableBody = document.querySelector("#excludedTableBody");

let selectedRange = "all";
let isLoading = false;

function getFreshDashboardUrl() {
  const url = new URL(RESULTS_API_URL);
  url.searchParams.set("dashboard", "true");
  url.searchParams.set("_t", Date.now().toString());

  if (startDateInput.value) {
    url.searchParams.set("startDate", startDateInput.value);
  }

  if (endDateInput.value) {
    url.searchParams.set("endDate", endDateInput.value);
  }

  return url.toString();
}

function setSyncStatus(message) {
  if (syncStatus) {
    syncStatus.textContent = message;
  }
}

function formatSyncTime(date) {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatNumber(value, digits = 1) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number);
}

function getStatusInfo(average, target) {
  const value = Number(average);

  if (!Number.isFinite(value) || value <= 0) {
    return {
      label: "ไม่มีข้อมูล",
      className: "is-empty",
      gapText: "ยังไม่มีค่าเฉลี่ย",
      progress: 0,
    };
  }

  const gap = value - target;
  const progress = Math.min(Math.max((value / target) * 100, 0), 140);

  if (gap >= 0) {
    return {
      label: "ผ่าน Target",
      className: "is-good",
      gapText: `สูงกว่าเป้า +${formatNumber(gap)}`,
      progress,
    };
  }

  return {
    label: "ต่ำกว่า Target",
    className: "is-warning",
    gapText: `ต่ำกว่าเป้า ${formatNumber(gap)}`,
    progress,
  };
}

function renderOverall(summary) {
  const info = getStatusInfo(summary.average, TARGETS.overall);

  overallCard.classList.remove("is-good", "is-warning", "is-empty");
  overallCard.classList.add(info.className);
  overallAverage.textContent = formatNumber(summary.average);
  overallStatus.textContent = info.label;
  overallGap.textContent = info.gapText;
  overallProgress.style.width = `${Math.min(info.progress, 100)}%`;
  validRows.textContent = new Intl.NumberFormat("th-TH").format(summary.validCount || 0);
  totalRows.textContent = new Intl.NumberFormat("th-TH").format(summary.totalRows || 0);
  excludedRows.textContent = `ตัดออก ${new Intl.NumberFormat("th-TH").format(summary.excludedCount || 0)} รายการ`;
}

function renderCategoryCards(categories) {
  categoryGrid.textContent = "";

  CATEGORY_CONFIG.forEach((config) => {
    const data = categories[config.key] || {};
    const info = getStatusInfo(data.average, config.target);
    const card = document.createElement("article");
    card.className = `category-card ${info.className}`;
    card.innerHTML = `
      <div class="category-title-row">
        <h3>${config.title}</h3>
        <span>${info.label}</span>
      </div>
      <div class="category-value">${formatNumber(data.average)}</div>
      <div class="category-meta">
        <span>Main KPI ${config.mainKpi}</span>
        <span>Target ≥ ${config.target}</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(info.progress, 100)}%"></div></div>
      <div class="category-foot">
        <span>${info.gapText}</span>
        <span>${new Intl.NumberFormat("th-TH").format(data.count || 0)} รายการ</span>
      </div>
    `;
    categoryGrid.appendChild(card);
  });
}

function renderBarChart(categories) {
  barChart.textContent = "";

  CATEGORY_CONFIG.forEach((config) => {
    const data = categories[config.key] || {};
    const average = Number(data.average) || 0;
    const target = config.target;
    const width = Math.min((average / Math.max(target, 1)) * 100, 130);
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-label">
        <strong>${config.shortTitle}</strong>
        <span>Avg ${formatNumber(average)} / Target ${target}</span>
      </div>
      <div class="bar-track">
        <div class="target-line" style="left:${Math.min(100, (target / Math.max(target, average, 1)) * 100)}%"></div>
        <div class="bar-fill" style="width:${width}%"></div>
      </div>
    `;
    barChart.appendChild(row);
  });

  chartNote.textContent = "เส้น Target = ค่าเป้าหมายของแต่ละประเภท";
}

function renderExcludedRows(rows) {
  const samples = Array.isArray(rows) ? rows.slice(0, 10) : [];
  excludedTableBody.textContent = "";

  if (samples.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6">ไม่มีรายการที่ถูกตัดออกในช่วงที่เลือก</td>`;
    excludedTableBody.appendChild(tr);
    return;
  }

  samples.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.date || "-"}</td>
      <td>${row.name || "-"}</td>
      <td>${row.userId || "-"}</td>
      <td>${row.totalPick || "-"}</td>
      <td>${row.averagePickHr || "-"}</td>
      <td>${row.reason || "ไม่ได้นำมาเฉลี่ย"}</td>
    `;
    excludedTableBody.appendChild(tr);
  });
}

function renderDashboard(payload) {
  if (!payload || payload.ok === false) {
    throw new Error(payload?.error || "โหลด Dashboard ไม่สำเร็จ");
  }

  renderOverall(payload.overall || {});
  renderCategoryCards(payload.categories || {});
  renderBarChart(payload.categories || {});
  renderExcludedRows(payload.excludedSamples || []);
}

async function loadDashboard(options = {}) {
  const { silent = false } = options;

  if (isLoading) {
    return;
  }

  isLoading = true;
  refreshButton.disabled = true;
  refreshButton.textContent = "กำลังรีเฟรช...";

  if (!silent) {
    setSyncStatus("กำลังดึงข้อมูลจาก Results Master...");
  }

  try {
    const response = await fetch(getFreshDashboardUrl(), { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const payload = await response.json();
    renderDashboard(payload);
    setSyncStatus(`อัปเดตล่าสุด ${formatSyncTime(new Date())}`);
  } catch (error) {
    console.error(error);
    setSyncStatus("โหลดข้อมูลไม่สำเร็จ ตรวจสอบ API / Deploy Apps Script อีกครั้ง");
  } finally {
    isLoading = false;
    refreshButton.disabled = false;
    refreshButton.textContent = "รีเฟรชข้อมูล";
  }
}

function toDateInputValue(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function setQuickRange(range) {
  selectedRange = range;
  const now = new Date();
  let start = "";
  let end = "";

  if (range === "today") {
    start = toDateInputValue(now);
    end = toDateInputValue(now);
  }

  if (range === "week") {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    start = toDateInputValue(monday);
    end = toDateInputValue(now);
  }

  if (range === "month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    start = toDateInputValue(firstDay);
    end = toDateInputValue(now);
  }

  startDateInput.value = start;
  endDateInput.value = end;

  quickFilterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.range === selectedRange);
  });

  loadDashboard();
}

quickFilterButtons.forEach((button) => {
  button.addEventListener("click", () => setQuickRange(button.dataset.range));
});

applyDateButton.addEventListener("click", () => {
  selectedRange = "custom";
  quickFilterButtons.forEach((button) => button.classList.remove("active"));
  loadDashboard();
});

refreshButton.addEventListener("click", () => loadDashboard());

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadDashboard({ silent: true });
  }
});

loadDashboard();
setInterval(() => loadDashboard({ silent: true }), REFRESH_INTERVAL_MS);
