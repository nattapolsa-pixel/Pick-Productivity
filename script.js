const RESULTS_API_URL = "https://script.google.com/macros/s/AKfycbyby7nOGMZe-w8pph0IZ7jz9WqQ17pwFhfW4TdWgoi1PJlkvXhYuNzHav48WBNsOkcGjg/exec";
const REFRESH_INTERVAL_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 45000;
const DAILY_INDEX_TIMEOUT_MS = 90000;
const DASHBOARD_CACHE_PREFIX = "pickProductivityDashboardCache:v55-pick-to-sort-total-pick";
const TARGET_STORAGE_KEY = "pickProductivityTargets:v1";
const PICK_TO_SORT_START_DATE_KEY = "2026-06-08";

const DEFAULT_TARGETS = Object.freeze({
  overall: 170,
  fullRack: 170,
  halfRack: 200,
  ea: 170,
  pickToSort: 170,
  training: 100,
});

function readStoredTargets() {
  try {
    const saved = JSON.parse(localStorage.getItem(TARGET_STORAGE_KEY) || "{}");
    return Object.keys(DEFAULT_TARGETS).reduce((config, key) => {
      const value = Number(saved[key]);
      config[key] = Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULT_TARGETS[key];
      return config;
    }, {});
  } catch (error) {
    console.warn(error);
    return { ...DEFAULT_TARGETS };
  }
}

const TARGETS = readStoredTargets();

function shouldCountPickTypeOnDate(key, dateKey) {
  if (key !== "pickToSort") {
    return true;
  }

  return Boolean(dateKey && dateKey >= PICK_TO_SORT_START_DATE_KEY);
}

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
  {
    key: "pickToSort",
    title: "Picking Productivity - Pick to Sort",
    shortTitle: "Pick to Sort",
    mainKpi: "Focus",
    target: TARGETS.pickToSort,
  },
];

const PICK_TYPE_DETAILS = [
  { key: "fullRack", title: "Picking Productivity - Full Rack (หยิบ)", label: "Full Rack", target: TARGETS.fullRack },
  { key: "halfRack", title: "Picking Productivity - Half Rack (หยิบ)", label: "Half Rack", target: TARGETS.halfRack },
  { key: "ea", title: "Picking Productivity - EA(หยิบ)", label: "EA", target: TARGETS.ea },
  { key: "pickToSort", title: "Picking Productivity - Pick to Sort", label: "Pick to Sort", target: TARGETS.pickToSort },
];

const ZONE_GROUPS = [
  {
    key: "fullRack",
    title: "Picking Productivity - Full Rack (หยิบ)",
    target: TARGETS.fullRack,
    zones: [
      { key: "fullRackAa", title: "Picking Productivity - Zone AA", label: "AA" },
      { key: "fullRackAgAh", title: "Picking Productivity - Zone AG-AH", label: "AG-AH" },
      { key: "fullRackAlBl", title: "Picking Productivity - Zone AL-BL", label: "AL-BL" },
      { key: "fullRackAnBn", title: "Picking Productivity - Zone AN-BN", label: "AN-BN" },
    ],
  },
  {
    key: "halfRack",
    title: "Picking Productivity - Half Rack (หยิบ)",
    target: TARGETS.halfRack,
    zones: [
      { key: "halfRackAiAk", title: "Picking Productivity - Zone AI-AK", label: "AI-AK" },
      { key: "halfRackBjBk", title: "Picking Productivity - Zone BJ-BK", label: "BJ-BK" },
      { key: "halfRackCbCe", title: "Picking Productivity - Zone CB-CE", label: "CB-CE" },
      { key: "halfRackCf", title: "Picking Productivity - Zone CF", label: "CF" },
    ],
  },
  {
    key: "ea",
    title: "Picking Productivity - EA (หยิบ)",
    target: TARGETS.ea,
    zones: [
      { key: "eaFa", title: "Picking Productivity - Zone EA-FA", label: "EA-FA", mainKpi: 85 },
      { key: "haHb", title: "Picking Productivity - Zone HA-HB", label: "HA-HB", mainKpi: 0 },
      { key: "ya", title: "Picking Productivity - Zone YA", label: "YA", mainKpi: 15 },
    ],
  },
];

const BU_GROUPS = [
  { key: "punthai", title: "BU - Punthai", label: "Punthai", focus: true, pickMix: { fullRack: 51, halfRack: 49, ea: 0 } },
  { key: "mart", title: "BU - Mart", label: "Mart", focus: true, pickMix: { fullRack: 40, halfRack: 50, ea: 10 } },
  { key: "other", title: "Other BU", label: "Other BU", focus: false, pickMix: {} },
];

function getPickTypeTarget(key) {
  if (key === "fullRack") return TARGETS.fullRack;
  if (key === "halfRack") return TARGETS.halfRack;
  if (key === "ea") return TARGETS.ea;
  if (key === "pickToSort") return TARGETS.pickToSort;
  return TARGETS.overall;
}

function syncTargetReferences() {
  CATEGORY_CONFIG.forEach((config) => {
    config.target = getPickTypeTarget(config.key);
  });

  PICK_TYPE_DETAILS.forEach((detail) => {
    detail.target = getPickTypeTarget(detail.key);
  });

  ZONE_GROUPS.forEach((group) => {
    group.target = getPickTypeTarget(group.key);
  });
}

function saveTargetsToStorage() {
  localStorage.setItem(TARGET_STORAGE_KEY, JSON.stringify(TARGETS));
}

syncTargetReferences();

const refreshButton = document.querySelector("#refreshButton");
const targetSettingsButton = document.querySelector("#targetSettingsButton");
const themeToggleButton = document.querySelector("#themeToggleButton");
const targetSettingsModal = document.querySelector("#targetSettingsModal");
const targetSettingsForm = document.querySelector("#targetSettingsForm");
const targetSettingsClose = document.querySelector("#targetSettingsClose");
const targetSettingsReset = document.querySelector("#targetSettingsReset");
const targetInputs = document.querySelectorAll("[data-target-input]");
const targetCloseElements = document.querySelectorAll("[data-target-close]");
const targetLabels = document.querySelectorAll("[data-target-label]");
const syncStatus = document.querySelector("#syncStatus");
const startDateInput = document.querySelector("#startDate");
const endDateInput = document.querySelector("#endDate");
const applyDateButton = document.querySelector("#applyDateButton");
const quickFilterButtons = document.querySelectorAll(".chip[data-range]");
const activeDateBanner = document.querySelector("#activeDateBanner");
const activeDateLabel = document.querySelector("#activeDateLabel");
const activeDateHint = document.querySelector("#activeDateHint");

const overallCard = document.querySelector("#overallCard");
const overallAverage = document.querySelector("#overallAverage");
const overallStatus = document.querySelector("#overallStatus");
const overallGap = document.querySelector("#overallGap");
const overallProgress = document.querySelector("#overallProgress");
const overviewTotalPick = document.querySelector("#overviewTotalPick");
const overviewTotalPickNote = document.querySelector("#overviewTotalPickNote");
const overviewPickToSortCard = document.querySelector("#overviewPickToSortCard");
const overviewPickToSortAverage = document.querySelector("#overviewPickToSortAverage");
const overviewPickToSortNote = document.querySelector("#overviewPickToSortNote");
const overviewTrainingCard = document.querySelector("#overviewTrainingCard");
const overviewTrainingPositiveRate = document.querySelector("#overviewTrainingPositiveRate");
const overviewTrainingPositiveNote = document.querySelector("#overviewTrainingPositiveNote");
const categoryGrid = document.querySelector("#categoryGrid");
const pickToSortGrid = document.querySelector("#pickToSortGrid");
const shiftGrid = document.querySelector("#shiftGrid");
const buGrid = document.querySelector("#buGrid");
const zoneBreakdownGrid = document.querySelector("#zoneBreakdownGrid");
const trainingGrid = document.querySelector("#trainingGrid");
const snapshotGrid = document.querySelector("#snapshotGrid");
const pickerGrid = document.querySelector("#pickerGrid");
const trainingSummaryGrid = document.querySelector("#trainingSummaryGrid");
const trainingTrendChart = document.querySelector("#trainingTrendChart");
const trainingFocusList = document.querySelector("#trainingFocusList");
const overallGauge = document.querySelector("#overallGauge");
const gaugeValue = document.querySelector("#gaugeValue");
const gaugeBadge = document.querySelector("#gaugeBadge");
const gaugeTargetText = document.querySelector("#gaugeTargetText");
const gaugeInsight = document.querySelector("#gaugeInsight");
const categoryMiniChart = document.querySelector("#categoryMiniChart");
const shiftMiniChart = document.querySelector("#shiftMiniChart");
const monthlyProductivityRange = document.querySelector("#monthlyProductivityRange");
const monthlyProductivitySummary = document.querySelector("#monthlyProductivitySummary");
const monthlyProductivityChart = document.querySelector("#monthlyProductivityChart");
const monthlyProductivityDays = document.querySelector("#monthlyProductivityDays");
const presentRangeButtons = document.querySelectorAll("[data-present-range]");
const presentPeriodLabel = document.querySelector("#presentPeriodLabel");
const presentHeadline = document.querySelector("#presentHeadline");
const presentNarrative = document.querySelector("#presentNarrative");
const presentScoreCard = document.querySelector("#presentScoreCard");
const presentOverallScore = document.querySelector("#presentOverallScore");
const presentOverallStatus = document.querySelector("#presentOverallStatus");
const presentKpiGrid = document.querySelector("#presentKpiGrid");
const presentHighlights = document.querySelector("#presentHighlights");
const presentRisks = document.querySelector("#presentRisks");
const presentActions = document.querySelector("#presentActions");

let selectedRange = "latest";
let isLoading = false;
let dailyIndexPayload = null;
let isDailyIndexLoading = false;
let isMonthlyTrendFallbackLoading = false;

// ---- Loading modal / progress helpers ----
const loadingModal = document.querySelector("#loadingModal");
const loadingProgressFill = document.querySelector("#loadingProgressFill");
const loadingPercent = document.querySelector("#loadingPercent");
const loadingEstimate = document.querySelector("#loadingEstimate");
const loadingClose = document.querySelector("#loadingClose");
let _loadingInterval = null;
let _loadingStartTs = 0;
let _loadingEstimatedMs = 8000;

// track current network request so it can be aborted
let currentRequest = null;

function abortCurrentRequest() {
  try {
    if (!currentRequest) return;
    if (currentRequest.type === "fetch" && currentRequest.controller) {
      currentRequest.controller.abort();
    }
    if (currentRequest.type === "jsonp") {
      // call stored reject and cleanup
      try {
        currentRequest.reject && currentRequest.reject(new Error("ยกเลิกการโหลดโดยผู้ใช้"));
      } catch (e) {}
      try { currentRequest.cleanup && currentRequest.cleanup(); } catch (e) {}
    }
  } finally {
    currentRequest = null;
    setSyncStatus("ยกเลิกการโหลด");
    hideLoadingModal();
  }
}

function setLoadingProgress(percent) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  if (loadingProgressFill) loadingProgressFill.style.width = `${p}%`;
  if (loadingPercent) loadingPercent.textContent = `${p}%`;
}

function showLoadingModal(estimatedMs = 8000) {
  if (!loadingModal) return;
  _loadingEstimatedMs = Number(estimatedMs) || 8000;
  _loadingStartTs = Date.now();
  loadingModal.hidden = false;
  document.body.classList.add("loading-open");
  setLoadingProgress(0);

  // show skeleton placeholders to improve perceived speed
  try { showSkeletons(); } catch (e) {}

  if (_loadingInterval) clearInterval(_loadingInterval);
  _loadingInterval = setInterval(() => {
    const elapsed = Date.now() - _loadingStartTs;
    const pct = Math.min(99, (elapsed / _loadingEstimatedMs) * 100);
    setLoadingProgress(pct);
    const remain = Math.max(0, Math.round((_loadingEstimatedMs - elapsed) / 1000));
    if (loadingEstimate) loadingEstimate.textContent = remain > 0 ? `คาดว่าเสร็จภายใน ~${remain} วินาที` : "กำลังประมวลผล...";
  }, 250);
  try { loadingClose?.focus(); } catch (e) {}
}

function hideLoadingModal() {
  if (!loadingModal) return;
  if (_loadingInterval) { clearInterval(_loadingInterval); _loadingInterval = null; }
  setLoadingProgress(100);
  setTimeout(() => {
    loadingModal.hidden = true;
    document.body.classList.remove("loading-open");
    setLoadingProgress(0);
    if (loadingEstimate) loadingEstimate.textContent = "";
    try { clearSkeletons(); } catch (e) {}
  }, 450);
}

if (loadingClose) {
  loadingClose.addEventListener("click", () => {
    // user-requested close -> abort network work
    abortCurrentRequest();
  });
}

// ---------------- Theme toggle ----------------
const THEME_KEY = 'pickDashboardTheme:v1';
function applyTheme(theme) {
  try {
    if (theme === 'light') document.documentElement.classList.add('light');
    else document.documentElement.classList.remove('light');
    if (themeToggleButton) themeToggleButton.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {}
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  applyTheme(saved || (prefersLight ? 'light' : 'dark'));
}

if (themeToggleButton) {
  themeToggleButton.addEventListener('click', () => {
    const isLight = document.documentElement.classList.contains('light');
    applyTheme(isLight ? 'dark' : 'light');
  });
}

// keyboard shortcuts: R = refresh, T = open target settings (when not typing)
document.addEventListener('keydown', (ev) => {
  const active = document.activeElement;
  const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
  if (isTyping) return;
  if (ev.key === 'r' || ev.key === 'R') {
    ev.preventDefault();
    loadDashboard({ force: true });
  }
  if (ev.key === 't' || ev.key === 'T') {
    ev.preventDefault();
    openTargetSettings();
  }
});

initTheme();

// Skeleton helpers
function showSkeletons() {
  try {
    if (snapshotGrid && snapshotGrid.children.length === 0) {
      snapshotGrid.innerHTML = Array.from({ length: 6 }).map(() => `
        <article class="snapshot-card is-empty skeleton-card">
          <span class="skeleton-line" style="width:40%"></span>
          <strong class="skeleton-line" style="width:60%"></strong>
          <small class="skeleton-line" style="width:80%"></small>
        </article>
      `).join("");
    }

    const fillIfEmpty = (el, template, count = 3) => {
      if (!el) return;
      if (el.children.length === 0) {
        el.innerHTML = Array.from({ length: count }).map(() => template).join("");
      }
    };

    fillIfEmpty(categoryGrid, `<div class="category-card skeleton-card"><h3 class="skeleton-line" style="width:50%"></h3><div class="category-value skeleton-line" style="width:60%"></div></div>`, 4);
    fillIfEmpty(pickToSortGrid, `<div class="category-card skeleton-card"><h3 class="skeleton-line" style="width:50%"></h3><div class="category-value skeleton-line" style="width:60%"></div></div>`, 3);
    fillIfEmpty(shiftGrid, `<div class="shift-card skeleton-card"><h3 class="skeleton-line" style="width:40%"></h3><div class="shift-value skeleton-line" style="width:50%"></div></div>`, 3);
    fillIfEmpty(trainingGrid, `<div class="training-card skeleton-card"><h3 class="skeleton-line" style="width:50%"></h3><div class="training-value skeleton-line" style="width:60%"></div></div>`, 3);
    fillIfEmpty(pickerGrid, `<div class="picker-board skeleton-card"><h3 class="skeleton-line" style="width:45%"></h3><div class="picker-row skeleton-line" style="width:100%"></div><div class="picker-row skeleton-line" style="width:92%"></div></div>`, 2);
    fillIfEmpty(buGrid, `<div class="bu-card skeleton-card"><h3 class="skeleton-line" style="width:50%"></h3><div class="bu-value skeleton-line" style="width:60%"></div></div>`, 2);
    fillIfEmpty(zoneBreakdownGrid, `<div class="zone-card skeleton-card"><h3 class="skeleton-line" style="width:50%"></h3><div class="zone-card-num skeleton-line" style="width:40%"></div></div>`, 3);
  } catch (e) { console.warn(e); }
}

function clearSkeletons() {
  try {
    [snapshotGrid, categoryGrid, pickToSortGrid, shiftGrid, trainingGrid, pickerGrid, buGrid, zoneBreakdownGrid].forEach((el) => {
      if (!el) return;
      // if it contains skeleton-card items, clear so render functions can populate
      const hasSkeleton = Array.from(el.children).some(c => c.classList && c.classList.contains('skeleton-card'));
      if (hasSkeleton) el.textContent = '';
    });
  } catch (e) { console.warn(e); }
}

function toDdMmYyyyFromInput(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return "";
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function getLatestDateInputFromPayload(payload = {}) {
  const rangeInfo = payload.totalPickRange || {};
  const diagnostics = payload.filterDiagnostics || {};
  const candidates = [
    rangeInfo.endDate,
    diagnostics.lastMatchedDate,
    payload.latestDate,
    payload.lastDate,
  ];

  for (const candidate of candidates) {
    const dateKey = toIsoDateKey(candidate);

    if (dateKey) {
      return dateKey;
    }
  }

  return "";
}

function getDashboardCacheKeyForDates(startDate = "", endDate = "") {
  return [
    DASHBOARD_CACHE_PREFIX,
    startDate || "all",
    endDate || "all",
  ].join(":");
}

function getDashboardUrl(options = {}) {
  const { force = false, callback = "", mode = "" } = options;
  const url = new URL(RESULTS_API_URL);
  url.searchParams.set("dashboard", "true");
  url.searchParams.set("_t", Date.now().toString());

  if (force) {
    url.searchParams.set("refresh", "true");
  }

  if (mode) {
    url.searchParams.set("mode", mode);
  }

  if (callback) {
    url.searchParams.set("callback", callback);
  }

  const requestStartDate = options.filterStartDate !== undefined ? options.filterStartDate : startDateInput.value;
  const requestEndDate = options.filterEndDate !== undefined ? options.filterEndDate : endDateInput.value;

  if (requestStartDate) {
    url.searchParams.set("startDate", requestStartDate);
    url.searchParams.set("startDateDMY", toDdMmYyyyFromInput(requestStartDate));
  }

  if (requestEndDate) {
    url.searchParams.set("endDate", requestEndDate);
    url.searchParams.set("endDateDMY", toDdMmYyyyFromInput(requestEndDate));
  }

  url.searchParams.set("dateFormat", "DMY");

  return url.toString();
}

function getDashboardCacheKey() {
  return getDashboardCacheKeyForDates(startDateInput.value, endDateInput.value);
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

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 0,
  }).format(Math.round(number));
}

function formatProductivityValue(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 1,
  }).format(number);
}

function formatInteger(value) {
  return new Intl.NumberFormat("th-TH").format(Number(value) || 0);
}

function animateValue(element, targetValue, formatter = null, duration = 800) {
  if (!element) return;
  const target = Number(targetValue);
  if (isNaN(target) || !isFinite(target) || target <= 0) {
    element.textContent = formatter ? formatter(targetValue) : String(targetValue);
    return;
  }

  const startTime = performance.now();
  const startValue = 0;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out cubic
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const currentValue = startValue + (target - startValue) * easeProgress;
    
    element.textContent = formatter ? formatter(currentValue) : String(Math.round(currentValue));

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = formatter ? formatter(target) : String(target);
    }
  }

  requestAnimationFrame(update);
}


function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    gapText: `ต่ำกว่าเป้า ${formatNumber(Math.abs(gap))}`,
    progress,
  };
}

function getSimpleTargetDirection(average, target) {
  const value = Number(average);
  const goal = Number(target);

  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(goal) || goal <= 0) {
    return "ไม่มีข้อมูล";
  }

  const gap = Math.round(value - goal);

  if (gap > 0) {
    return `สูงกว่า Target +${formatNumber(gap)} Pick/Hr`;
  }

  if (gap < 0) {
    return `ต่ำกว่า Target ${formatNumber(Math.abs(gap))} Pick/Hr`;
  }

  return "เท่ากับ Target";
}

function createSummaryFromKpi(kpi, target, fallbackTotalRows = 0, fallbackExcluded = 0) {
  const average = Number(kpi?.average || 0);
  const count = Number(kpi?.count || 0);
  const total = Number(kpi?.totalRows || fallbackTotalRows || count || 0);
  const excluded = Number(kpi?.excludedCount || fallbackExcluded || Math.max(total - count, 0));

  return {
    average,
    count,
    validCount: Number(kpi?.validCount || count || 0),
    totalRows: total,
    excludedCount: excluded,
    target,
    gap: average - target,
    status: average >= target ? "ผ่าน Target" : "ต่ำกว่า Target",
  };
}


function createEmptyPickerSummary() {
  return { total: 0, top: [], bottom: [] };
}

function normalizePickerSummary(pickers) {
  if (!pickers || typeof pickers !== "object") {
    return createEmptyPickerSummary();
  }

  const normalizeRows = (items) => (Array.isArray(items) ? items : [])
    .filter((item) => item && Number(item.count || 0) > 0)
    .map((item, index) => ({
      key: item.key || item.userId || item.name || `picker-${index + 1}`,
      rank: Number(item.rank || index + 1),
      userId: item.userId || "",
      name: item.name || item.userId || "ไม่ระบุชื่อ",
      average: Number(item.average || 0),
      count: Number(item.count || 0),
      totalPick: Number(item.totalPick || item.pickTotal || item.total || 0),
      target: Number(item.target || TARGETS.overall),
      gap: Number(item.gap || 0),
      status: item.status || "",
      mainShift: item.mainShift || "ไม่ระบุกะ",
      mainAffiliation: item.mainAffiliation || "ไม่ระบุสังกัด",
      mainBu: item.mainBu || "-",
      mainPickType: item.mainPickType || "-",
      mainZone: item.mainZone || "ไม่ระบุ Zone",
    }));

  const top = normalizeRows(pickers.top);
  const bottom = normalizeRows(pickers.bottom);
  return {
    total: Number(pickers.total || Math.max(top.length, bottom.length, 0)),
    top,
    bottom,
  };
}

function createEmptyPickToSortDetails() {
  return {
    overall: createSummaryFromKpi(null, TARGETS.pickToSort),
    totalPick: 0,
    shifts: [],
    bu: [],
    pickers: createEmptyPickerSummary(),
    startDate: "08/06/2026",
    sourceColumn: "AK",
  };
}

function normalizePickToSortDetails(details, payload = {}) {
  const fallback = createEmptyPickToSortDetails();
  const source = details && typeof details === "object" ? details : {};
  const overall = source.overall || payload.categories?.pickToSort || fallback.overall;

  return {
    ...fallback,
    ...source,
    overall: {
      ...createSummaryFromKpi(overall, TARGETS.pickToSort),
      ...overall,
      target: TARGETS.pickToSort,
    },
    totalPick: Number(source.totalPick || 0),
    shifts: Array.isArray(source.shifts) ? source.shifts : [],
    bu: Array.isArray(source.bu) ? source.bu : [],
    pickers: normalizePickerSummary(source.pickers),
  };
}

function createEmptyMonthlyProductivityTrend() {
  return {
    month: "",
    monthLabel: "",
    startDate: "",
    endDate: "",
    metricLabel: "Avg Pick/Hr",
    sourceColumn: "Results Master!C / AF",
    average: null,
    activeDays: 0,
    totalPick: 0,
    peakDay: null,
    lowDay: null,
    days: [],
  };
}

function normalizeMonthlyProductivityTrend(trend) {
  if (!trend || typeof trend !== "object") {
    return createEmptyMonthlyProductivityTrend();
  }

  return {
    ...createEmptyMonthlyProductivityTrend(),
    ...trend,
    average: trend.average === null || trend.average === undefined ? null : Number(trend.average || 0),
    activeDays: Number(trend.activeDays || 0),
    totalPick: Number(trend.totalPick || 0),
    days: Array.isArray(trend.days) ? trend.days.map((day, index) => ({
      date: day.date || "",
      dateLabel: day.dateLabel || day.date || "",
      day: Number(day.day || index + 1),
      productivity: day.productivity === null || day.productivity === undefined ? null : Number(day.productivity || 0),
      count: Number(day.count || 0),
      totalPick: Number(day.totalPick || 0),
      hasData: Boolean(day.hasData),
      change: day.change === null || day.change === undefined ? null : Number(day.change || 0),
      trend: day.trend || "none",
    })) : [],
  };
}

function normalizeDashboardPayload(payload) {
  if (!payload || payload.ok === false) {
    return payload;
  }

  if (payload.overall && payload.categories) {
    return {
      ...payload,
      zones: Array.isArray(payload.zones) ? payload.zones : [],
      bu: Array.isArray(payload.bu) ? payload.bu : [],
      shifts: Array.isArray(payload.shifts) ? payload.shifts : [],
      training: Array.isArray(payload.training) ? payload.training : [],
      monthlyTrend: normalizeMonthlyProductivityTrend(payload.monthlyTrend),
      totalPick: Number(payload.totalPick || 0),
      pickers: normalizePickerSummary(payload.pickers),
      pickToSortDetails: normalizePickToSortDetails(payload.pickToSortDetails, payload),
      needsZoneApiUpdate: !Array.isArray(payload.zones),
      needsBuApiUpdate: !Array.isArray(payload.bu),
      needsShiftApiUpdate: !Array.isArray(payload.shifts),
      needsPickerApiUpdate: !payload.pickers,
    };
  }

  if (!Array.isArray(payload.kpis)) {
    return payload;
  }

  const kpiMap = payload.kpis.reduce((map, item) => {
    map[item.key] = item;
    return map;
  }, {});
  const validRows = Number(payload.source?.validRows || payload.totalRows || 0);

  return {
    ok: true,
    generatedAt: payload.generatedAt || new Date().toISOString(),
    elapsedMs: payload.elapsedMs || 0,
    cacheStatus: payload.cached ? "instant-cache" : "fresh",
    overall: createSummaryFromKpi(kpiMap.overall, TARGETS.overall, validRows),
    categories: {
      fullRack: createSummaryFromKpi(kpiMap.fullRack, TARGETS.fullRack),
      halfRack: createSummaryFromKpi(kpiMap.halfRack, TARGETS.halfRack),
      ea: createSummaryFromKpi(kpiMap.ea, TARGETS.ea),
      pickToSort: createSummaryFromKpi(kpiMap.pickToSort, TARGETS.pickToSort),
    },
    zones: [],
    bu: [],
    shifts: [],
    training: [],
    monthlyTrend: createEmptyMonthlyProductivityTrend(),
    pickers: createEmptyPickerSummary(),
    pickToSortDetails: createEmptyPickToSortDetails(),
    totalPick: Number(payload.totalPick || 0),
    totalRows: validRows,
    filteredRows: validRows,
    excludedSamples: [],
  };
}

function setText(element, value) {
  if (!element) return;
  // if element is numeric and marked for animation, animate the number
  const asNumber = Number(String(value).replace(/[^0-9\-\.]/g, ""));
  if (!Number.isNaN(asNumber) && (element.dataset.animate === "number" || element.classList.contains("count-animate"))) {
    animateNumber(element, asNumber, String(value));
    return;
  }

  element.textContent = value;
}

// Animate numeric change: element, numeric target, optional display string
function animateNumber(element, targetNumber, displayString) {
  try {
    const start = Number((element.dataset._animatedStart != null) ? element.dataset._animatedStart : Number(element.textContent.replace(/[^0-9\-\.]/g, "")) || 0);
    const duration = 600;
    const startTs = performance.now();

    function step(now) {
      const t = Math.min(1, (now - startTs) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(start + (targetNumber - start) * eased);
      element.textContent = displayString && /\D/.test(String(displayString)) ? String(displayString).replace(/[-0-9,.]+/, value) : String(value);
      if (t < 1) requestAnimationFrame(step);
      else { element.dataset._animatedStart = targetNumber; }
    }

    requestAnimationFrame(step);
  } catch (e) {
    element.textContent = displayString || String(targetNumber);
  }
}

// ---------------- IndexedDB simple cache ----------------
function idbOpen() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open('pickDashboard', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}

async function idbPut(key, value) {
  try {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite');
      const store = tx.objectStore('cache');
      const r = store.put(value, key);
      r.onsuccess = () => { resolve(true); db.close(); };
      r.onerror = () => { reject(r.error); db.close(); };
    });
  } catch (e) { console.warn('IDB put failed', e); }
}

async function idbGet(key) {
  try {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readonly');
      const store = tx.objectStore('cache');
      const r = store.get(key);
      r.onsuccess = () => { resolve(r.result); db.close(); };
      r.onerror = () => { reject(r.error); db.close(); };
    });
  } catch (e) { console.warn('IDB get failed', e); }
}

function updateStaticTargetLabels() {
  targetLabels.forEach((element) => {
    const key = element.dataset.targetLabel;
    const value = TARGETS[key] || TARGETS.overall;
    element.textContent = `Target ≥ ${value}`;
  });

  setText(gaugeTargetText, `Target ≥ ${TARGETS.overall}`);
}

function applyTargetToSummary(summary, target) {
  if (!summary || typeof summary !== "object") {
    return summary;
  }

  const average = Number(summary.average || 0);
  summary.target = target;
  summary.gap = round1(average - target);
  summary.status = average >= target ? "ผ่าน Target" : "ต่ำกว่า Target";
  return summary;
}

function applyCurrentTargets(payload) {
  if (!payload || payload.ok === false) {
    return payload;
  }

  syncTargetReferences();
  applyTargetToSummary(payload.overall, TARGETS.overall);

  CATEGORY_CONFIG.forEach((config) => {
    applyTargetToSummary(payload.categories?.[config.key], config.target);
  });

  (Array.isArray(payload.shifts) ? payload.shifts : []).forEach((shift) => {
    applyTargetToSummary(shift, TARGETS.overall);
    (Array.isArray(shift.affiliations) ? shift.affiliations : []).forEach((affiliation) => {
      applyTargetToSummary(affiliation, TARGETS.overall);
    });
  });

  (Array.isArray(payload.bu) ? payload.bu : []).forEach((bu) => {
    applyTargetToSummary(bu, TARGETS.overall);
    (Array.isArray(bu.details) ? bu.details : []).forEach((detail) => {
      applyTargetToSummary(detail, getPickTypeTarget(detail.key));
    });
  });

  (Array.isArray(payload.zones) ? payload.zones : []).forEach((group) => {
    const groupTarget = getPickTypeTarget(group.key);
    group.target = groupTarget;
    (Array.isArray(group.zones) ? group.zones : []).forEach((zone) => {
      zone.target = groupTarget;
      applyTargetToSummary(zone, groupTarget);
    });
  });

  (Array.isArray(payload.training) ? payload.training : []).forEach((item) => {
    item.target = TARGETS.training;
  });

  payload.pickers = normalizePickerSummary(payload.pickers);
  ["top", "bottom"].forEach((groupKey) => {
    payload.pickers[groupKey].forEach((item) => applyTargetToSummary(item, TARGETS.overall));
  });

  payload.pickToSortDetails = normalizePickToSortDetails(payload.pickToSortDetails, payload);
  applyTargetToSummary(payload.pickToSortDetails.overall, TARGETS.pickToSort);
  (Array.isArray(payload.pickToSortDetails.shifts) ? payload.pickToSortDetails.shifts : []).forEach((shift) => {
    applyTargetToSummary(shift, TARGETS.pickToSort);
    (Array.isArray(shift.affiliations) ? shift.affiliations : []).forEach((affiliation) => {
      applyTargetToSummary(affiliation, TARGETS.pickToSort);
    });
  });
  (Array.isArray(payload.pickToSortDetails.bu) ? payload.pickToSortDetails.bu : []).forEach((bu) => {
    applyTargetToSummary(bu, TARGETS.pickToSort);
  });
  ["top", "bottom"].forEach((groupKey) => {
    payload.pickToSortDetails.pickers[groupKey].forEach((item) => applyTargetToSummary(item, TARGETS.pickToSort));
  });

  return payload;
}

function setTargetFormValues() {
  targetInputs.forEach((input) => {
    const key = input.dataset.targetInput;
    input.value = TARGETS[key] || DEFAULT_TARGETS[key] || TARGETS.overall;
  });
}

function getTargetFormValues() {
  return Array.from(targetInputs).reduce((values, input) => {
    const key = input.dataset.targetInput;
    const value = Math.round(Number(input.value));

    if (key && Number.isFinite(value) && value > 0) {
      values[key] = value;
    }

    return values;
  }, {});
}

function rerenderWithCurrentTargets(sourceLabel = "ปรับ Target แล้ว") {
  syncTargetReferences();
  updateStaticTargetLabels();
  setTargetFormValues();

  if (lastRenderedPayload) {
    renderDashboard(lastRenderedPayload, { sourceLabel });
    return;
  }

  renderDashboardFromLocalCache();
}

function openTargetSettings() {
  if (!targetSettingsModal) return;
  setTargetFormValues();
  targetSettingsModal.hidden = false;
  document.body.classList.add("target-modal-open");
  targetInputs[0]?.focus();
}

function closeTargetSettings() {
  if (!targetSettingsModal) return;
  targetSettingsModal.hidden = true;
  document.body.classList.remove("target-modal-open");
}

function updateTargets(nextTargets, sourceLabel) {
  Object.keys(DEFAULT_TARGETS).forEach((key) => {
    const value = Number(nextTargets[key]);
    TARGETS[key] = Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULT_TARGETS[key];
  });

  saveTargetsToStorage();
  rerenderWithCurrentTargets(sourceLabel);
}

function renderOverallVisual(summary) {
  if (!overallGauge) {
    return;
  }

  const info = getStatusInfo(summary.average, TARGETS.overall);
  const score = Math.min(Math.max(info.progress, 0), 100);

  overallGauge.style.setProperty("--score-angle", `${score * 3.6}deg`);
  overallGauge.classList.remove("is-good", "is-warning", "is-empty");
  overallGauge.classList.add(info.className);
  setText(gaugeValue, formatNumber(summary.average));
  setText(gaugeBadge, info.label);

  setText(gaugeInsight, getSimpleTargetDirection(summary.average, TARGETS.overall));

  if (gaugeBadge) {
    gaugeBadge.className = `status-pill ${info.className}`;
  }
}

function renderMiniChart(container, items, emptyText) {
  if (!container) {
    return;
  }

  container.textContent = "";

  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mini-empty";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = `mini-bar-row`;
    row.innerHTML = `
      <div class="mini-bar-label">${item.label}</div>
      <div class="mini-bar-track">
        <div class="mini-bar-fill ${item.className}" style="width:${Math.min(item.progress, 100)}%"></div>
      </div>
      <div class="mini-bar-value">${formatNumber(item.average)}</div>
    `;
    container.appendChild(row);
  });
}

function getMonthlyTrendText(day) {
  if (!day || !day.hasData) {
    return "ไม่มีข้อมูล";
  }

  if (day.change === null || day.change === undefined) {
    return "วันแรก";
  }

  const change = Number(day.change || 0);

  if (change > 0) {
    return `ขึ้น ${formatProductivityValue(change)}`;
  }

  if (change < 0) {
    return `ลง ${formatProductivityValue(Math.abs(change))}`;
  }

  return "เท่าเดิม";
}

function buildMonthlyProductivitySvg(days, metricLabel) {
  const safeDays = Array.isArray(days) ? days : [];
  const values = safeDays
    .filter((day) => day?.hasData && Number.isFinite(Number(day.productivity)))
    .map((day) => Number(day.productivity));

  if (values.length === 0) {
    return `<div class="monthly-productivity-empty">ยังไม่มีข้อมูล Productivity ในเดือนนี้</div>`;
  }

  const width = 1040;
  const height = 330;
  const pad = { top: 24, right: 24, bottom: 58, left: 62 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxValue = Math.max(...values, TARGETS.overall, 1);
  const scaleMax = Math.ceil((maxValue * 1.12) / 10) * 10;
  const step = safeDays.length > 1 ? plotWidth / (safeDays.length - 1) : plotWidth;
  const barWidth = Math.max(7, Math.min(16, (plotWidth / Math.max(safeDays.length, 1)) * 0.48));
  const yOf = (value) => pad.top + plotHeight - ((Number(value || 0) / scaleMax) * plotHeight);
  const points = safeDays
    .map((day, index) => ({
      day,
      x: pad.left + (index * step),
      y: yOf(day.productivity),
    }))
    .filter((point) => point.day.hasData);
  const path = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const targetY = yOf(TARGETS.overall);

  const grid = [0, 0.5, 1].map((ratio) => {
    const value = scaleMax * ratio;
    const y = yOf(value);
    return `
      <line class="monthly-chart-grid" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"></line>
      <text class="monthly-chart-axis" x="${pad.left - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(formatProductivityValue(value))}</text>
    `;
  }).join("");

  const bars = safeDays.map((day, index) => {
    const x = pad.left + (index * step);
    const barHeight = day.hasData ? Math.max(2, pad.top + plotHeight - yOf(day.productivity)) : 2;
    const y = pad.top + plotHeight - barHeight;
    const detailText = day.hasData
      ? `${formatInteger(day.count)} รายการ · Total pick ${formatInteger(day.totalPick)}`
      : "";

    return `
      <rect class="monthly-chart-bar ${day.hasData ? day.trend || "flat" : "no-data"}" 
            x="${x - (barWidth / 2)}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4"
            data-tooltip-title="${escapeHtml(day.dateLabel)}"
            data-tooltip-value="${escapeHtml(day.hasData ? formatProductivityValue(day.productivity) + ' ' + metricLabel : 'ไม่มีข้อมูล')}"
            data-tooltip-detail="${escapeHtml(detailText)}"
            data-tooltip-trend="${day.trend || 'none'}">
      </rect>
    `;
  }).join("");

  const dots = points.map((point) => {
    const day = point.day;
    const detailText = day.hasData
      ? `${formatInteger(day.count)} รายการ · Total pick ${formatInteger(day.totalPick)}`
      : "";
    return `
      <circle class="monthly-chart-dot ${day.trend || "flat"}" cx="${point.x}" cy="${point.y}" r="4"
              data-tooltip-title="${escapeHtml(day.dateLabel)}"
              data-tooltip-value="${escapeHtml(formatProductivityValue(day.productivity) + ' ' + metricLabel)}"
              data-tooltip-detail="${escapeHtml(detailText)}"
              data-tooltip-trend="${day.trend || 'none'}">
      </circle>
    `;
  }).join("");

  const labels = safeDays.map((day, index) => {
    const x = pad.left + (index * step);
    return `<text class="monthly-chart-date" x="${x}" y="${height - 24}" text-anchor="middle">${escapeHtml(String(day.day || index + 1))}</text>`;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="กราฟ Productivity รายวันตั้งแต่วันที่ 1 ถึงวันสิ้นเดือน">
      ${grid}
      <line class="monthly-chart-target" x1="${pad.left}" y1="${targetY}" x2="${width - pad.right}" y2="${targetY}"></line>
      <text class="monthly-chart-target-label" x="${width - pad.right}" y="${targetY - 8}" text-anchor="end">Target ${TARGETS.overall}</text>
      ${bars}
      <path class="monthly-chart-line" d="${path}"></path>
      ${dots}
      ${labels}
      <text class="monthly-chart-title" x="${pad.left}" y="${height - 8}">${escapeHtml(metricLabel)} / วันที่ของเดือน</text>
    </svg>
  `;
}

let chartTooltipInitialized = false;

function setupChartTooltips() {
  if (chartTooltipInitialized) return;
  const chartContainer = document.querySelector("#monthlyProductivityChart");
  if (!chartContainer) return;

  let tooltip = document.querySelector("#chartTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "chartTooltip";
    tooltip.className = "chart-tooltip glass";
    tooltip.style.position = "fixed";
    tooltip.style.display = "none";
    tooltip.style.pointerEvents = "none";
    tooltip.style.zIndex = "1000";
    document.body.appendChild(tooltip);
  }

  chartContainer.addEventListener("mouseover", (e) => {
    const target = e.target.closest("[data-tooltip-title]");
    if (!target) return;

    const title = target.getAttribute("data-tooltip-title");
    const val = target.getAttribute("data-tooltip-value");
    const detail = target.getAttribute("data-tooltip-detail");
    const trend = target.getAttribute("data-tooltip-trend");

    let trendIcon = "⚪";
    if (trend === "up") trendIcon = "🟢 ▲";
    if (trend === "down") trendIcon = "🔴 ▼";
    if (trend === "flat") trendIcon = "🟡 ▬";

    tooltip.innerHTML = `
      <div class="tooltip-title">${title}</div>
      <div class="tooltip-value">${val} <span class="tooltip-trend">${trendIcon}</span></div>
      ${detail ? `<div class="tooltip-detail">${detail}</div>` : ""}
    `;
    tooltip.style.display = "block";
  });

  chartContainer.addEventListener("mousemove", (e) => {
    if (tooltip.style.display === "block") {
      tooltip.style.left = `${e.clientX + 15}px`;
      tooltip.style.top = `${e.clientY + 15}px`;
    }
  });

  chartContainer.addEventListener("mouseout", (e) => {
    const target = e.target.closest("[data-tooltip-title]");
    if (target) {
      tooltip.style.display = "none";
    }
  });

  chartTooltipInitialized = true;
}

function renderMonthlyProductivityTrend(rawTrend) {
  if (!monthlyProductivityRange || !monthlyProductivitySummary || !monthlyProductivityChart || !monthlyProductivityDays) {
    return;
  }

  const trend = normalizeMonthlyProductivityTrend(rawTrend);
  const metricLabel = trend.metricLabel || "Avg Pick/Hr";
  const rangeText = trend.startDate && trend.endDate
    ? `${trend.monthLabel || trend.month || ""} · ${trend.startDate} ถึง ${trend.endDate}`
    : "วันที่ 1 ถึงวันสิ้นเดือน";
  monthlyProductivityRange.textContent = `${rangeText} · ${metricLabel} จาก ${trend.sourceColumn || "Results Master!AF"}`;

  const summaryItems = [
    { label: "เฉลี่ยเดือน", value: trend.average === null ? "-" : formatProductivityValue(trend.average) },
    { label: "วันสูงสุด", value: trend.peakDay ? `${trend.peakDay.dateLabel} · ${formatProductivityValue(trend.peakDay.productivity)}` : "-" },
    { label: "วันต่ำสุด", value: trend.lowDay ? `${trend.lowDay.dateLabel} · ${formatProductivityValue(trend.lowDay.productivity)}` : "-" },
    { label: "วันที่มีข้อมูล", value: `${formatInteger(trend.activeDays)} วัน` },
  ];

  monthlyProductivitySummary.innerHTML = summaryItems.map((item) => `
    <div class="monthly-summary-chip">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </div>
  `).join("");

  monthlyProductivityChart.innerHTML = buildMonthlyProductivitySvg(trend.days, metricLabel);
  setupChartTooltips();
  
  monthlyProductivityDays.innerHTML = trend.days.map((day) => {
    const valueText = day.hasData ? formatProductivityValue(day.productivity) : "-";
    const detailText = day.hasData
      ? `${formatInteger(day.count)} รายการ · Total pick ${formatInteger(day.totalPick)}`
      : "ไม่มีข้อมูล";

    return `
      <article class="monthly-day-card ${day.hasData ? day.trend || "flat" : "no-data"}">
        <span>${escapeHtml(day.dateLabel || "")}</span>
        <strong>${escapeHtml(valueText)}</strong>
        <small>${escapeHtml(getMonthlyTrendText(day))}</small>
        <em>${escapeHtml(detailText)}</em>
      </article>
    `;
  }).join("");
}

function hasMonthlyProductivityTrendData(rawTrend) {
  const trend = normalizeMonthlyProductivityTrend(rawTrend);
  return trend.days.some((day) => day.hasData && Number.isFinite(Number(day.productivity)));
}

function renderMonthlyProductivityTrendFromDailyIndex(sourceLabel = "กราฟรายเดือนจาก Daily Index") {
  if (!dailyIndexPayload || dailyIndexPayload.ok === false || dailyIndexPayload.mode !== "dailyIndex") {
    return false;
  }

  const trend = buildMonthlyProductivityTrendFromDailyIndex(dailyIndexPayload, []);
  renderMonthlyProductivityTrend(trend);

  if (lastRenderedPayload) {
    lastRenderedPayload.monthlyTrend = trend;
    saveDashboardToLocalCache(lastRenderedPayload);
  }

  if (syncStatus) {
    const currentText = syncStatus.textContent || sourceLabel;
    setSyncStatus(currentText.includes(sourceLabel) ? currentText : `${currentText} | ${sourceLabel}`);
  }

  return hasMonthlyProductivityTrendData(trend);
}

function ensureMonthlyProductivityTrend(rawPayload) {
  if (hasMonthlyProductivityTrendData(rawPayload?.monthlyTrend)) {
    return;
  }

  if (loadDailyIndexFromLocalCache() && renderMonthlyProductivityTrendFromDailyIndex()) {
    return;
  }

  if (isMonthlyTrendFallbackLoading) {
    return;
  }

  isMonthlyTrendFallbackLoading = true;
  const currentText = syncStatus?.textContent || "";

  if (currentText && !currentText.includes("กำลังเติมกราฟรายเดือน")) {
    setSyncStatus(`${currentText} | กำลังเติมกราฟรายเดือน...`);
  }

  loadDailyIndex({ force: false })
    .then((payload) => {
      if (payload?.ok && payload.mode === "dailyIndex") {
        renderMonthlyProductivityTrendFromDailyIndex();
      }
    })
    .finally(() => {
      isMonthlyTrendFallbackLoading = false;
    });
}

function renderCategoryVisual(categories) {
  const items = CATEGORY_CONFIG.map((config) => {
    const data = categories[config.key] || {};
    const average = Number(data.average) || 0;
    const info = getStatusInfo(average, config.target);

    return {
      label: config.shortTitle,
      average,
      count: data.count || 0,
      className: info.className,
      progress: info.progress,
      targetMark: 100,
      note: `Target ≥ ${config.target} | Main KPI ${config.mainKpi}`,
    };
  });

  renderMiniChart(categoryMiniChart, items, "ยังไม่มีข้อมูล Rack / EA");
}

function renderShiftVisual(shifts) {
  const items = Array.isArray(shifts)
    ? shifts
      .slice()
      .sort((left, right) => (Number(left.average) || 0) - (Number(right.average) || 0))
      .slice(0, 5)
      .map((shift) => {
        const average = Number(shift.average) || 0;
        const target = Number(shift.target || TARGETS.overall);
        const info = getStatusInfo(average, target);

        return {
          label: shift.label || shift.title || "ไม่ระบุกะ",
          average,
          count: shift.count || 0,
          className: info.className,
          progress: info.progress,
          targetMark: 100,
          note: `Target ≥ ${target} | Share ${formatNumber(shift.share || 0)}%`,
        };
      })
    : [];

  renderMiniChart(shiftMiniChart, items, "ยังไม่มีข้อมูล Shift");
}

function renderVisualOverview(payload) {
  renderOverallVisual(payload.overall || {});
  renderCategoryVisual(payload.categories || {});
  renderShiftVisual(payload.shifts || []);
}

function formatSignedNumber(value) {
  const number = Math.round(Number(value) || 0);
  return `${number > 0 ? "+" : ""}${formatNumber(number)}`;
}

function percentOf(value, total) {
  const numerator = Number(value) || 0;
  const denominator = Number(total) || 0;
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function getTrainingTrendInfo(item) {
  const average = Number(item?.average || 0);
  const improvement = Number(item?.improvement || 0);
  const firstCount = Number(item?.first30Count || 0);
  const secondCount = Number(item?.second30Count || 0);
  const count = Number(item?.count || 0);
  const hasBothPeriods = firstCount > 0 && secondCount > 0;

  if (count <= 0) {
    return {
      key: "noData",
      label: "ยังไม่มีข้อมูลหยิบ",
      className: "is-empty",
      short: "No data",
      message: "มีรายชื่อ Training แล้ว แต่ยังไม่มีข้อมูล Productivity ในช่วง Training",
    };
  }

  if (hasBothPeriods && improvement >= 10) {
    return {
      key: "improved",
      label: "ดีขึ้นชัดเจน",
      className: "is-good",
      short: "ดีขึ้น",
      message: `ช่วงหลังดีขึ้น ${formatSignedNumber(improvement)} Pick/Hr`,
    };
  }

  if (hasBothPeriods && improvement > 0) {
    return {
      key: "improved",
      label: "ดีขึ้น",
      className: "is-good",
      short: "ดีขึ้น",
      message: `ช่วงหลังดีขึ้น ${formatSignedNumber(improvement)} Pick/Hr`,
    };
  }

  if (hasBothPeriods && improvement <= -10) {
    return {
      key: "declined",
      label: "ลดลงชัดเจน",
      className: "is-warning",
      short: "ลดลง",
      message: `ช่วงหลังลดลง ${formatSignedNumber(improvement)} Pick/Hr`,
    };
  }

  if (hasBothPeriods && improvement < 0) {
    return {
      key: "declined",
      label: "ลดลง",
      className: "is-warning",
      short: "ลดลง",
      message: `ช่วงหลังลดลง ${formatSignedNumber(improvement)} Pick/Hr`,
    };
  }

  if (average >= TARGETS.training) {
    return {
      key: "onTarget",
      label: "ผ่านเป้า Training",
      className: "is-good",
      short: "ผ่านเป้า",
      message: `ค่าเฉลี่ย ${formatNumber(average)} ผ่าน Target Training ${TARGETS.training}`,
    };
  }

  if (count > 0 && average < TARGETS.training) {
    return {
      key: "belowTarget",
      label: "ต่ำกว่าเป้า Training",
      className: "is-danger",
      short: "ต่ำกว่าเป้า",
      message: `ต่ำกว่า Target Training ${TARGETS.training} อยู่ ${formatNumber(TARGETS.training - average)} Pick/Hr`,
    };
  }

  return {
    key: "notEnough",
    label: "ข้อมูลยังไม่พอ",
    className: "is-empty",
    short: "รอดูเพิ่ม",
    message: hasBothPeriods ? "สองช่วงใกล้เคียงกัน" : "ยังไม่มีข้อมูลครบทั้ง 30 วันแรกและ 30 วันหลัง",
  };
}

function summarizeTraining(trainingItems) {
  const items = Array.isArray(trainingItems) ? trainingItems : [];
  const summary = {
    total: items.length,
    withData: 0,
    comparable: 0,
    improved: 0,
    declined: 0,
    onTarget: 0,
    noData: 0,
    notEnough: 0,
    belowTarget: 0,
    avgImprovement: 0,
  };
  let improvementSum = 0;

  items.forEach((item) => {
    const info = getTrainingTrendInfo(item);
    const count = Number(item.count || 0);
    const hasBothPeriods = Number(item.first30Count || 0) > 0 && Number(item.second30Count || 0) > 0;

    if (count > 0) summary.withData += 1;
    if (hasBothPeriods) {
      summary.comparable += 1;
      improvementSum += Number(item.improvement || 0);
    }

    if (info.key === "improved") summary.improved += 1;
    if (info.key === "declined") summary.declined += 1;
    if (info.key === "onTarget") summary.onTarget += 1;
    if (info.key === "noData") summary.noData += 1;
    if (info.key === "belowTarget") summary.belowTarget += 1;
    if (info.key === "notEnough") summary.notEnough += 1;
  });

  summary.avgImprovement = summary.comparable > 0 ? Math.round(improvementSum / summary.comparable) : 0;
  return summary;
}

function renderSnapshotOverview(payload) {
  // ปิดแถว Snapshot ด้านบนถาวร เพื่อไม่ให้ 4 การ์ดเก่ากลับมาอีก
  if (snapshotGrid) {
    snapshotGrid.innerHTML = "";
    snapshotGrid.hidden = true;
  }
}



function renderOverviewTrainingKpi(trainingItems) {
  if (!overviewTrainingPositiveRate && !overviewTrainingPositiveNote) return;

  const summary = summarizeTraining(trainingItems || []);
  const positive = Number(summary.improved || 0) + Number(summary.onTarget || 0);
  const withData = Number(summary.withData || 0);
  const rate = percentOf(positive, Math.max(withData, 1));
  const hasData = withData > 0;
  const className = !hasData ? "is-empty" : rate >= 60 ? "is-good" : "is-warning";

  if (overviewTrainingCard) {
    overviewTrainingCard.classList.remove("is-good", "is-warning", "is-empty");
    overviewTrainingCard.classList.add(className);
  }

  setText(overviewTrainingPositiveRate, hasData ? `${rate}%` : "-");
  setText(
    overviewTrainingPositiveNote,
    hasData
      ? `${formatInteger(positive)} จาก ${formatInteger(withData)} คนที่มีข้อมูล`
      : "ยังไม่มีข้อมูล Training"
  );
}

function getPresentRangeLabel() {
  const start = startDateInput?.value ? toDdMmYyyyFromInput(startDateInput.value) : "";
  const end = endDateInput?.value ? toDdMmYyyyFromInput(endDateInput.value) : "";

  if (selectedRange === "week") return "Weekly Summary";
  if (selectedRange === "month") return "Monthly Summary";
  if (selectedRange === "today") return "Today Summary";
  if (selectedRange === "latest" || selectedRange === "autoLatest") return "Latest Day Summary";
  if (selectedRange === "custom" && (start || end)) return `${start || "เริ่มต้น"} ถึง ${end || "ล่าสุด"}`;
  return "All Data Summary";
}

function getOverviewTotalPickRangeText(payload = {}) {
  const rangeInfo = payload.totalPickRange || {};
  const diagnostics = payload.filterDiagnostics || {};
  const inputStart = startDateInput?.value ? toDdMmYyyyFromInput(startDateInput.value) : "";
  const inputEnd = endDateInput?.value ? toDdMmYyyyFromInput(endDateInput.value) : "";

  const start = rangeInfo.startDate || diagnostics.firstMatchedDate || inputStart || "";
  const end = rangeInfo.endDate || diagnostics.lastMatchedDate || inputEnd || "";

  if (start && end && start === end) {
    return `ยอดของวันที่ ${start}`;
  }

  if (start && end) {
    return `ยอดตั้งแต่ ${start} ถึง ${end}`;
  }

  if (start) {
    return `ยอดตั้งแต่ ${start} ถึงล่าสุด`;
  }

  if (end) {
    return `ยอดถึงวันที่ ${end}`;
  }

  return "ยอดจากช่วงข้อมูลทั้งหมด";
}

function getCategoryInsightItems(categories) {
  return CATEGORY_CONFIG.map((config) => {
    const data = categories?.[config.key] || {};
    const average = Number(data.average || 0);
    const count = Number(data.count || data.validCount || 0);
    return {
      key: config.key,
      label: config.shortTitle,
      average,
      count,
      target: config.target,
      gap: average - config.target,
      status: getStatusInfo(average, config.target),
    };
  });
}

function getZoneInsightItems(zoneGroups) {
  return (Array.isArray(zoneGroups) ? zoneGroups : [])
    .flatMap((group) => (Array.isArray(group.zones) ? group.zones : []).map((zone) => ({
      label: zone.label || zone.title || "Zone",
      title: zone.title || zone.label || "Zone",
      average: Number(zone.average || 0),
      count: Number(zone.count || 0),
      target: Number(zone.target || group.target || TARGETS.overall),
    })))
    .filter((zone) => zone.count > 0)
    .map((zone) => ({ ...zone, gap: zone.average - zone.target }));
}

function getPresentPeriodClass() {
  if (selectedRange === "week") return "Weekly";
  if (selectedRange === "month") return "Monthly";
  return "Selected Period";
}

function renderPresentList(container, items, emptyText) {
  if (!container) return;
  const safeItems = Array.isArray(items) && items.length > 0 ? items : [emptyText];
  container.innerHTML = safeItems.map((item) => `<li>${item}</li>`).join("");
}

function renderPresentSummary(payload) {
  if (!presentKpiGrid) return;

  const overall = payload.overall || {};
  const overallAverage = Number(overall.average || 0);
  const overallInfo = getStatusInfo(overallAverage, TARGETS.overall);
  const categoryItems = getCategoryInsightItems(payload.categories || {});
  const categoriesWithData = categoryItems.filter((item) => item.count > 0);
  const weakestCategory = categoriesWithData.slice().sort((left, right) => left.gap - right.gap)[0] || categoryItems[0];
  const bestCategory = categoriesWithData.slice().sort((left, right) => right.gap - left.gap)[0] || categoryItems[0];
  const shiftItems = Array.isArray(payload.shifts) ? payload.shifts.filter((item) => Number(item.count || 0) > 0) : [];
  const weakestShift = shiftItems.slice().sort((left, right) => Number(left.average || 0) - Number(right.average || 0))[0];
  const bestShift = shiftItems.slice().sort((left, right) => Number(right.average || 0) - Number(left.average || 0))[0];
  const zoneItems = getZoneInsightItems(payload.zones || []);
  const weakZones = zoneItems.filter((zone) => zone.gap < 0).sort((left, right) => left.gap - right.gap);
  const trainingSummary = summarizeTraining(payload.training || []);
  const trainingPositive = trainingSummary.improved + trainingSummary.onTarget;
  const trainingPositiveRate = percentOf(trainingPositive, Math.max(trainingSummary.withData, 1));
  const focusBu = (Array.isArray(payload.bu) ? payload.bu : [])
    .filter((item) => item.focus && Number(item.count || 0) > 0)
    .sort((left, right) => Number(left.average || 0) - Number(right.average || 0))[0];
  const pickToSortItem = categoryItems.find((item) => item.key === "pickToSort") || { label: "Pick to Sort", average: 0, count: 0, target: TARGETS.pickToSort, gap: -TARGETS.pickToSort };
  const pickToSortInfo = getStatusInfo(pickToSortItem.average, TARGETS.pickToSort);
  const presentRange = getPresentRangeLabel();
  const periodClass = getPresentPeriodClass();
  const overallGapText = overallAverage >= TARGETS.overall
    ? `สูงกว่า Target ${formatNumber(overallAverage - TARGETS.overall)} Pick/Hr`
    : `ต่ำกว่า Target ${formatNumber(TARGETS.overall - overallAverage)} Pick/Hr`;
  const previousOverallAverage = Number(payload.previousPayload?.overall?.average || 0);
  const comparisonSentence = payload.previousPayload && previousOverallAverage > 0
    ? `${getComparisonMeta(payload).label || "เทียบวันก่อน"}: ${formatCompareDelta(overallAverage - previousOverallAverage, "Pick/Hr")}${formatTargetContext(overallAverage, TARGETS.overall, "Pick/Hr")}`
    : `${getComparisonMeta(payload).label || "เทียบวันก่อน"}: ยังไม่มีข้อมูลเทียบ${formatTargetContext(overallAverage, TARGETS.overall, "Pick/Hr")}`;
  const mainFocus = weakestCategory
    ? `${weakestCategory.label} Avg ${formatNumber(weakestCategory.average)} / Target ${weakestCategory.target}`
    : "ยังไม่มีข้อมูลประเภทงาน";

  setText(presentPeriodLabel, presentRange);
  setText(presentOverallScore, formatNumber(overallAverage));
  setText(presentOverallStatus, `${overallInfo.label} · ${overallGapText}`);

  if (presentScoreCard) {
    presentScoreCard.classList.remove("is-good", "is-warning", "is-empty");
    presentScoreCard.classList.add(overallInfo.className);
  }

  setText(
    presentHeadline,
    overallAverage >= TARGETS.overall
      ? `${periodClass}: Productivity อยู่ในระดับผ่านเป้าภาพรวม`
      : `${periodClass}: Productivity ยังต่ำกว่าเป้าภาพรวม`
  );

  const shiftSentence = weakestShift
    ? `ด้าน Shift จุดที่ควรดูต่อคือ ${weakestShift.label || weakestShift.title || "ไม่ระบุกะ"} ที่ Avg ${formatNumber(weakestShift.average)} จาก ${formatInteger(weakestShift.count || 0)} รายการ`
    : "ด้าน Shift ยังไม่มีข้อมูลพอสำหรับสรุป";
  const trainingSentence = trainingSummary.withData > 0
    ? `Training มี ${formatInteger(trainingPositive)} จาก ${formatInteger(trainingSummary.withData)} คนที่ดีขึ้นหรือผ่านเป้า (${trainingPositiveRate}%)`
    : "Training ยังไม่มีข้อมูลเพียงพอสำหรับสรุปเชิงแนวโน้ม";
  const pickToSortSentence = pickToSortItem.count > 0
    ? `Pick to Sort Avg ${formatNumber(pickToSortItem.average)} เทียบ Target ${TARGETS.pickToSort} จาก ${formatInteger(pickToSortItem.count)} รายการ`
    : "Pick to Sort ยังไม่มีข้อมูลในช่วงที่เลือก";

  setText(
    presentNarrative,
    `ภาพรวมช่วง ${presentRange} อยู่ที่ Avg ${formatNumber(overallAverage)} Pick/Hr (${overallGapText}). ${comparisonSentence}. จุดโฟกัสหลักคือ ${mainFocus}. ${pickToSortSentence}. ${shiftSentence}. ${trainingSentence}.`
  );

  const kpiCards = [
    { label: "Overall", value: formatNumber(overallAverage), note: `${overallGapText} · ${comparisonSentence}`, className: overallInfo.className },
    { label: "ประเภทงานที่ควรโฟกัส", value: weakestCategory?.label || "-", note: weakestCategory ? `ต่ำ/สูงกว่าเป้า ${formatSignedNumber(weakestCategory.gap)}` : "ยังไม่มีข้อมูล", className: weakestCategory && weakestCategory.gap >= 0 ? "is-good" : "is-warning" },
    { label: "Shift ที่ควรดู", value: weakestShift ? (weakestShift.label || weakestShift.title || "-") : "-", note: weakestShift ? `Avg ${formatNumber(weakestShift.average)} · ${formatInteger(weakestShift.count || 0)} รายการ` : "ยังไม่มีข้อมูล", className: weakestShift && Number(weakestShift.average || 0) >= TARGETS.overall ? "is-good" : "is-warning" },
    { label: "Training ดีขึ้น/ผ่านเป้า", value: `${trainingPositiveRate}%`, note: `${formatInteger(trainingPositive)} จาก ${formatInteger(trainingSummary.withData)} คน`, className: trainingPositiveRate >= 60 ? "is-good" : trainingPositiveRate > 0 ? "is-warning" : "is-empty" },
    { label: "Zone ต่ำกว่าเป้า", value: formatInteger(weakZones.length), note: weakZones[0] ? `${weakZones[0].label} ต่ำสุด` : "ไม่มี Zone ต่ำกว่าเป้า", className: weakZones.length > 0 ? "is-warning" : "is-good" },
    { label: "BU Focus", value: focusBu ? (focusBu.label || focusBu.title || "BU") : "-", note: focusBu ? `Avg ${formatNumber(focusBu.average)} · Share ${formatNumber(focusBu.share || 0)}%` : "ยังไม่มีข้อมูล Punthai/Mart", className: focusBu && Number(focusBu.average || 0) >= TARGETS.overall ? "is-good" : "is-warning" },
    { label: "Pick to Sort", value: formatNumber(pickToSortItem.average), note: pickToSortItem.count > 0 ? `${pickToSortInfo.gapText} · ${formatInteger(pickToSortItem.count)} รายการ` : "ยังไม่มีข้อมูล Pick to Sort", className: pickToSortItem.count > 0 ? pickToSortInfo.className : "is-empty" },
  ];

  presentKpiGrid.innerHTML = kpiCards.map((card) => `
    <article class="present-kpi-card ${card.className}">
      <span>${card.label}</span>
      <strong>${card.value}</strong>
      <small>${card.note}</small>
    </article>
  `).join("");

  const highlights = [
    bestCategory ? `${bestCategory.label} ทำได้ดีที่สุดใน Rack / EA: Avg ${formatNumber(bestCategory.average)} เทียบ Target ${bestCategory.target}` : "ยังไม่มีข้อมูล Rack / EA ที่นำมาจัดอันดับ",
    bestShift ? `${bestShift.label || bestShift.title || "Shift"} เป็นกะที่ทำได้ดีที่สุด: Avg ${formatNumber(bestShift.average)}` : "ยังไม่มีข้อมูล Shift ที่นำมาจัดอันดับ",
    trainingSummary.withData > 0 ? `Training ที่ดีขึ้นหรือผ่านเป้าอยู่ที่ ${trainingPositiveRate}% ของคนที่มีข้อมูล` : "Training ยังต้องรอข้อมูลเพิ่ม",
    pickToSortItem.count > 0 ? `Pick to Sort อยู่ที่ Avg ${formatNumber(pickToSortItem.average)} จาก ${formatInteger(pickToSortItem.count)} รายการ` : "Pick to Sort ยังไม่มีข้อมูลในช่วงที่เลือก",
  ];

  const risks = [
    overallAverage < TARGETS.overall ? `Overall ยังต่ำกว่า Target ${TARGETS.overall} อยู่ ${formatNumber(TARGETS.overall - overallAverage)} Pick/Hr` : "Overall ผ่าน Target ภาพรวมแล้ว ให้รักษาระดับและดูจุดย่อยต่อ",
    weakestCategory && weakestCategory.gap < 0 ? `${weakestCategory.label} ต่ำกว่า Target มากสุดในกลุ่ม Rack / EA (${formatNumber(Math.abs(weakestCategory.gap))} Pick/Hr)` : "Rack / EA ไม่มีประเภทหลักที่ต่ำกว่าเป้าในช่วงนี้",
    weakZones.length > 0 ? `Zone ที่ควรดูแรกคือ ${weakZones[0].label} Avg ${formatNumber(weakZones[0].average)} ต่ำกว่า Target ${formatNumber(Math.abs(weakZones[0].gap))}` : "Zone ส่วนใหญ่ไม่มีสัญญาณต่ำกว่าเป้า",
    trainingSummary.belowTarget > 0 ? `Training ต่ำกว่า Target ${TARGETS.training} จำนวน ${formatInteger(trainingSummary.belowTarget)} คน` : `Training ไม่มีคนที่ต่ำกว่า Target ${TARGETS.training} จากข้อมูลที่มี`,
    pickToSortItem.count > 0 && pickToSortItem.average < TARGETS.pickToSort ? `Pick to Sort ต่ำกว่า Target ${TARGETS.pickToSort} อยู่ ${formatNumber(TARGETS.pickToSort - pickToSortItem.average)} Pick/Hr` : "Pick to Sort ไม่มีสัญญาณต่ำกว่าเป้าจากข้อมูลที่มี",
  ];

  const actions = [
    weakestCategory && weakestCategory.gap < 0 ? `ให้หัวหน้างานเริ่มจาก ${weakestCategory.label} เพราะเป็นจุดที่ดึงค่า Overall ลงมากที่สุด` : "ใช้ข้อมูลนี้เป็น baseline แล้วติดตามซ้ำในรอบถัดไป",
    weakestShift ? `รีวิววิธีทำงานของ ${weakestShift.label || weakestShift.title || "Shift ที่ต่ำสุด"} เทียบกับกะที่ทำได้ดีที่สุด` : "รอข้อมูล Shift เพิ่มก่อนตัดสินใจเชิงปฏิบัติการ",
    weakZones.length > 0 ? `เปิดดูหน้า Zone เพื่อเจาะ ${weakZones.slice(0, 3).map((zone) => zone.label).join(" / ")} ก่อน` : "ใช้หน้า Zone เพื่อติดตามต่อว่าพื้นที่ไหนเริ่มหลุดเป้า",
    trainingSummary.belowTarget > 0 ? "ให้ Training list เป็นรายการ follow-up รายบุคคลในรอบประชุมถัดไป" : "รักษาแนวโน้ม Training และเพิ่มตัวอย่าง Best Practice จากคนที่ดีขึ้น",
    pickToSortItem.count > 0 ? "ใช้ Pick to Sort เป็นจุดติดตามแยก เพราะเป็นงานช่วยคัด/ส่งต่อที่ไม่ควรถูกกลืนไปกับ Rack / EA" : "รอข้อมูล Pick to Sort เพิ่ม แล้วค่อยเทียบแนวโน้มกับประเภทงานหลัก",
  ];

  renderPresentList(presentHighlights, highlights, "ยังไม่มีข้อมูลจุดเด่นสำหรับช่วงนี้");
  renderPresentList(presentRisks, risks, "ยังไม่มีความเสี่ยงสำคัญจากข้อมูลช่วงนี้");
  renderPresentList(presentActions, actions, "ยังไม่มีข้อเสนอเพิ่มเติม");

  presentRangeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.presentRange === selectedRange);
  });
}

function renderTrainingSummaryCards(trainingItems) {
  if (!trainingSummaryGrid) return;

  const summary = summarizeTraining(trainingItems);
  const positive = summary.improved + summary.onTarget;
  const positiveRate = percentOf(positive, Math.max(summary.withData, 1));
  const cards = [
    { label: "Training ทั้งหมด", value: formatInteger(summary.total), note: `${formatInteger(summary.withData)} คนมีข้อมูล`, className: "is-neutral" },
    { label: "ดีขึ้น / ผ่านเป้า", value: `${positiveRate}%`, note: `${formatInteger(positive)} คน`, className: positiveRate >= 60 ? "is-good" : "is-warning" },
    { label: "ลดลง", value: formatInteger(summary.declined), note: "ควรดูรายละเอียดก่อน", className: summary.declined > 0 ? "is-warning" : "is-good" },
    { label: `ต่ำกว่า Target ${TARGETS.training}`, value: formatInteger(summary.belowTarget), note: "มีข้อมูลแล้วแต่ยังต่ำกว่าเป้า", className: summary.belowTarget > 0 ? "is-danger" : "is-good" },
  ];

  trainingSummaryGrid.innerHTML = cards.map((card) => `
    <article class="training-summary-card ${card.className}">
      <span>${card.label}</span>
      <strong>${card.value}</strong>
      <small>${card.note}</small>
    </article>
  `).join("");
}

function renderTrainingTrendChart(trainingItems) {
  if (!trainingTrendChart) return;

  const summary = summarizeTraining(trainingItems);
  const total = Math.max(summary.total, 1);
  const segments = [
    { key: "improved", label: "ดีขึ้น", value: summary.improved, className: "is-good" },
    { key: "onTarget", label: "ผ่านเป้า", value: summary.onTarget, className: "is-good-alt" },
    { key: "declined", label: "ลดลง", value: summary.declined, className: "is-warning" },
    { key: "belowTarget", label: `ต่ำกว่า Target ${TARGETS.training}`, value: summary.belowTarget, className: "is-danger" },
    { key: "notEnough", label: "ข้อมูลยังไม่พอ", value: summary.notEnough, className: "is-empty" },
    { key: "noData", label: "ไม่มีข้อมูล", value: summary.noData, className: "is-muted" },
  ].filter((item) => item.value > 0);

  if (segments.length === 0) {
    trainingTrendChart.innerHTML = `<div class="training-empty-state">ยังไม่มีข้อมูล Training ให้สรุป</div>`;
    return;
  }

  const stack = segments.map((item) => `
    <span class="training-stack-segment ${item.className}" style="width:${Math.max(percentOf(item.value, total), 4)}%" title="${item.label}: ${item.value}"></span>
  `).join("");
  const legend = segments.map((item) => `
    <div class="training-legend-row">
      <i class="${item.className}"></i>
      <span>${item.label}</span>
      <strong>${formatInteger(item.value)}</strong>
    </div>
  `).join("");

  trainingTrendChart.innerHTML = `
    <div class="training-stack-bar">${stack}</div>
    <div class="training-stack-meta">
      <strong>${formatInteger(summary.total)} คน</strong>
      <span>${formatInteger(summary.comparable)} คนมีข้อมูลครบสองช่วง</span>
    </div>
    <div class="training-legend">${legend}</div>
  `;
}

function renderTrainingFocusList(trainingItems) {
  if (!trainingFocusList) return;

  const items = Array.isArray(trainingItems) ? trainingItems.slice() : [];
  const focusItems = items
    .map((item) => ({ item, info: getTrainingTrendInfo(item) }))
    .sort((left, right) => {
      const priority = { belowTarget: 0, declined: 1, noData: 2, notEnough: 3, onTarget: 4, improved: 5 };
      const priorityDiff = (priority[left.info.key] ?? 9) - (priority[right.info.key] ?? 9);
      return priorityDiff || Number(left.item.improvement || 0) - Number(right.item.improvement || 0);
    })
    .slice(0, 6);

  if (focusItems.length === 0) {
    trainingFocusList.innerHTML = `<div class="training-empty-state">ยังไม่มีรายชื่อ Training</div>`;
    return;
  }

  trainingFocusList.innerHTML = focusItems.map(({ item, info }) => `
    <div class="training-focus-row ${info.className}">
      <div>
        <strong>${item.name || "ไม่ระบุชื่อ"}</strong>
        <span>${item.userId ? `User ID: ${item.userId}` : ""}</span>
      </div>
      <div class="training-focus-value">
        <strong>${formatNumber(item.average)}</strong>
        <span>${info.short}</span>
      </div>
    </div>
  `).join("");
}
function renderOverall(summary, payload = {}) {
  const info = getStatusInfo(summary.average, TARGETS.overall);

  overallCard.classList.remove("is-good", "is-warning", "is-empty");
  overallCard.classList.add(info.className);
  // Animate Overall Average count
  animateValue(overallAverage, summary.average, formatNumber);
  overallStatus.textContent = info.label;
  overallGap.textContent = getSimpleTargetDirection(summary.average, TARGETS.overall);
  overallProgress.style.width = `${Math.min(info.progress, 100)}%`;
  const totalPickValue = Number(payload.totalPick || 0);
  // Animate Total Pick count
  if (overviewTotalPick) animateValue(overviewTotalPick, totalPickValue, formatInteger);
  if (overviewTotalPickNote) {
    overviewTotalPickNote.innerHTML = `${escapeHtml(getOverviewTotalPickRangeText(payload))}${getCompareNoteHtml(totalPickValue, payload.previousPayload?.totalPick, payload, "รายการ")}`;
  }

  const pickToSortSummary = payload.categories?.pickToSort || {};
  const pickToSortAverage = Number(pickToSortSummary.average || 0);
  const pickToSortInfo = getStatusInfo(pickToSortAverage, TARGETS.pickToSort);
  if (overviewPickToSortCard) {
    overviewPickToSortCard.classList.remove("is-good", "is-warning", "is-empty");
    overviewPickToSortCard.classList.add(pickToSortInfo.className);
  }
  if (overviewPickToSortAverage) animateValue(overviewPickToSortAverage, pickToSortAverage, formatNumber);
  if (overviewPickToSortNote) {
    overviewPickToSortNote.innerHTML = `${pickToSortInfo.gapText} · ${formatInteger(pickToSortSummary.count || 0)} รายการ${getCompareNoteHtml(pickToSortAverage, payload.previousPayload?.categories?.pickToSort?.average, payload, "Pick/Hr", TARGETS.pickToSort)}`;
  }
  const overallCompare = getCompareNoteHtml(summary.average, payload.previousPayload?.overall?.average, payload, "Pick/Hr", TARGETS.overall);
  const existingOverallCompare = overallCard.querySelector(".compare-note");
  if (existingOverallCompare) existingOverallCompare.remove();
  overallCard.insertAdjacentHTML("beforeend", overallCompare);

  // อัพเดต Sidebar KPI mini
  const sidebarOverall = document.querySelector("#sidebarOverall");
  const sidebarProgress = document.querySelector("#sidebarProgress");
  const sidebarStatus = document.querySelector("#sidebarStatus");
  // Animate Sidebar count
  if (sidebarOverall) animateValue(sidebarOverall, summary.average, formatNumber);
  if (sidebarProgress) sidebarProgress.style.width = `${Math.min(info.progress, 100)}%`;
  if (sidebarStatus) {
    sidebarStatus.textContent = info.label;
    sidebarStatus.style.color = info.className === "is-good" ? "var(--good)" : info.className === "is-warning" ? "var(--warn)" : "var(--text-muted)";
  }
}

function renderCategoryCards(categories, payload = {}) {
  categoryGrid.textContent = "";

  CATEGORY_CONFIG.forEach((config) => {
    const data = categories[config.key] || {};
    const info = getStatusInfo(data.average, config.target);
    const card = document.createElement("article");
    card.className = `category-card ${info.className}${config.key === "pickToSort" ? " is-pick-to-sort" : ""}`;
    card.innerHTML = `
      <div class="category-title-row">
        <h3>${config.title}</h3>
        <span>${info.label}</span>
      </div>
      <div class="category-value">-</div>
      <div class="category-meta">
        <span>Main KPI ${config.mainKpi}</span>
        <span>Target ≥ ${config.target}</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(info.progress, 100)}%"></div></div>
      <div class="category-foot">
        <span>${info.gapText}</span>
        <span>${formatInteger(data.count || 0)} รายการ</span>
      </div>
      ${getCompareNoteHtml(data.average, payload.previousPayload?.categories?.[config.key]?.average, payload, "Pick/Hr", config.target)}
    `;
    categoryGrid.appendChild(card);

    // Animate category value after card is appended
    const valueEl = card.querySelector(".category-value");
    animateValue(valueEl, data.average, formatNumber);
  });
}

function getPickToSortBuItems(payload, details) {
  const detailBuItems = Array.isArray(details?.bu) ? details.bu.filter((item) => Number(item.count || 0) > 0) : [];

  if (detailBuItems.length > 0) {
    return detailBuItems;
  }

  const derived = (Array.isArray(payload?.bu) ? payload.bu : []).map((bu) => {
    const p2s = (Array.isArray(bu.details) ? bu.details : []).find((detail) => detail.key === "pickToSort") || {};
    return {
      key: bu.key,
      title: bu.title,
      label: bu.label,
      focus: bu.focus,
      share: Number(p2s.count || 0),
      ...p2s,
      target: TARGETS.pickToSort,
    };
  }).filter((item) => Number(item.count || 0) > 0);
  const totalCount = derived.reduce((sum, item) => sum + Number(item.count || 0), 0);

  return derived.map((item) => ({
    ...item,
    share: totalCount > 0 ? percentOf(Number(item.count || 0), totalCount) : 0,
  }));
}

function renderPickToSortDashboard(payload = {}) {
  if (!pickToSortGrid) return;

  const details = normalizePickToSortDetails(payload.pickToSortDetails, payload);
  const overall = Number(details.overall?.count || 0) > 0
    ? details.overall
    : (payload.categories?.pickToSort || details.overall);
  const average = Number(overall.average || 0);
  const count = Number(overall.count || 0);
  const totalPick = Number(details.totalPick || 0);
  const info = getStatusInfo(average, TARGETS.pickToSort);
  const buItems = getPickToSortBuItems(payload, details);
  const shiftItems = Array.isArray(details.shifts) ? details.shifts.filter((item) => Number(item.count || 0) > 0) : [];
  const pickerSummary = normalizePickerSummary(details.pickers);
  const previousAverage = payload.previousPayload?.pickToSortDetails?.overall?.average
    ?? payload.previousPayload?.categories?.pickToSort?.average;

  const buHtml = buItems.length > 0
    ? buItems.map((item) => {
      const itemInfo = getStatusInfo(item.average, TARGETS.pickToSort);
      return `
        <article class="p2s-mini-card ${itemInfo.className}">
          <div>
            <span>${escapeHtml(item.title || item.label || "BU")}</span>
            <strong>${formatNumber(item.average)}</strong>
          </div>
          <small>${itemInfo.gapText} · ${formatInteger(item.count || 0)} รายการ · Share ${formatNumber(item.share || 0)}%</small>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.min(itemInfo.progress, 100)}%"></div></div>
        </article>
      `;
    }).join("")
    : `<article class="p2s-mini-card is-empty"><span>BU</span><strong>-</strong><small>ยังไม่มีข้อมูล Pick to Sort ตาม BU</small></article>`;

  const shiftHtml = shiftItems.length > 0
    ? shiftItems.map((item) => {
      const itemInfo = getStatusInfo(item.average, TARGETS.pickToSort);
      return `
        <article class="p2s-mini-card ${itemInfo.className}">
          <div>
            <span>${escapeHtml(item.label || item.title || "Shift")}</span>
            <strong>${formatNumber(item.average)}</strong>
          </div>
          <small>${itemInfo.gapText} · ${formatInteger(item.count || 0)} รายการ · Share ${formatNumber(item.share || 0)}%</small>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.min(itemInfo.progress, 100)}%"></div></div>
        </article>
      `;
    }).join("")
    : `<article class="p2s-mini-card is-empty"><span>Shift</span><strong>-</strong><small>ยังไม่มีข้อมูล Pick to Sort ตามกะ</small></article>`;

  pickToSortGrid.innerHTML = `
    <section class="p2s-hero-card ${info.className}">
      <div>
        <p class="visual-card-eyebrow">PICK TO SORT AVG</p>
        <h2>${formatNumber(average)}</h2>
        <span>Target ≥ ${TARGETS.pickToSort} · เริ่มนับ 8/6/2026</span>
      </div>
      <div class="p2s-hero-meta">
        <strong>${info.label}</strong>
        <span>${info.gapText}</span>
        <small>${formatInteger(count)} รายการ</small>
        <div class="p2s-total-pick">
          <span>Total Pick เฉพาะ Pick to Sort</span>
          <strong>${formatInteger(totalPick)}</strong>
        </div>
        ${getCompareNoteHtml(average, previousAverage, payload, "Pick/Hr", TARGETS.pickToSort)}
      </div>
    </section>

    <section class="p2s-section">
      <div class="p2s-section-head">
        <div>
          <p class="visual-card-eyebrow">BU BREAKDOWN</p>
          <h2>Pick to Sort แยกตาม BU</h2>
        </div>
        <span class="status-pill muted">${formatInteger(buItems.length)} BU</span>
      </div>
      <div class="p2s-mini-grid">${buHtml}</div>
    </section>

    <section class="p2s-section">
      <div class="p2s-section-head">
        <div>
          <p class="visual-card-eyebrow">SHIFT BREAKDOWN</p>
          <h2>Pick to Sort แยกตามกะ</h2>
        </div>
        <span class="status-pill muted">${formatInteger(shiftItems.length)} Shift</span>
      </div>
      <div class="p2s-mini-grid">${shiftHtml}</div>
    </section>

    <section class="p2s-picker-grid">
      ${renderPickerBoard("P2S TOP", "คนที่ทำ Pick to Sort สูงสุด", "คำนวณเฉพาะแถว Pick to Sort จาก Column AK", pickerSummary.top, "ยังไม่มีข้อมูล Top Pick to Sort", payload)}
      ${renderPickerBoard("P2S BOTTOM", "คนที่ควรโฟกัสใน Pick to Sort", "เรียงจาก Avg Pick/Hr ต่ำไปสูง เฉพาะ Pick to Sort", pickerSummary.bottom, "ยังไม่มีข้อมูล Bottom Pick to Sort", payload)}
    </section>
  `;
}

function renderShiftAffiliations(affiliations) {
  if (!Array.isArray(affiliations) || affiliations.length === 0) {
    return "";
  }

  const rows = affiliations.map((item) => {
    const target = Number(item.target || TARGETS.overall);
    const info = getStatusInfo(item.average, target);

    return `
      <div class="shift-affiliation-row ${info.className}">
        <div class="shift-affiliation-main">
          <strong>${item.title || item.label || "ไม่ระบุสังกัด"}</strong>
          <span>Target ≥ ${target}</span>
        </div>
        <div class="shift-affiliation-value">${formatNumber(item.average)}</div>
        <div class="shift-affiliation-foot">
          <span>${info.gapText}</span>
          <span>${formatInteger(item.count || 0)} รายการ</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.min(info.progress, 100)}%"></div></div>
      </div>
    `;
  }).join("");

  return `<div class="shift-affiliation-list">${rows}</div>`;
}

function renderShiftBreakdown(shifts, payload = {}) {
  if (!shiftGrid) {
    return;
  }

  shiftGrid.textContent = "";

  if (!Array.isArray(shifts) || shifts.length === 0) {
    const empty = document.createElement("article");
    empty.className = "shift-card is-empty";
    empty.textContent = "ยังไม่มีข้อมูล Shift จาก API ให้ Deploy Apps Script เวอร์ชันล่าสุด แล้วกดรีเฟรชข้อมูลอีกครั้ง";
    shiftGrid.appendChild(empty);
    return;
  }

  shifts.forEach((item) => {
    const target = Number(item.target || TARGETS.overall);
    const info = getStatusInfo(item.average, target);
    const affiliationRows = renderShiftAffiliations(item.affiliations);
    const card = document.createElement("article");
    card.className = `shift-card ${info.className}`;
    card.innerHTML = `
      <div class="shift-title-row">
        <div>
          <span>Shift</span>
          <h3>${item.title || item.label || "ไม่ระบุกะ"}</h3>
        </div>
        <strong>${info.label}</strong>
      </div>
      <div class="shift-value">-</div>
      <div class="shift-meta">
        <span>Target ≥ ${target}</span>
        <span>Share ${formatNumber(item.share || 0)}%</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(info.progress, 100)}%"></div></div>
      <div class="shift-foot">
        <span>${info.gapText}</span>
        <span>${formatInteger(item.count || 0)} รายการ</span>
      </div>
      ${getCompareNoteHtml(item.average, findByLabel(payload.previousPayload?.shifts, item.label || item.title)?.average, payload, "Pick/Hr", target)}
      ${affiliationRows}
    `;
    shiftGrid.appendChild(card);

    // Animate shift value count
    const valueEl = card.querySelector(".shift-value");
    animateValue(valueEl, item.average, formatNumber);
  });
}

function renderBuDetailRows(details) {
  if (!Array.isArray(details) || details.length === 0) {
    return "";
  }

  const rows = details.map((detail) => {
    const target = Number(detail.target || TARGETS.overall);
    const info = getStatusInfo(detail.average, target);
    const weightText = typeof detail.mainKpi === "number" ? `${formatNumber(detail.mainKpi)}%` : "-";

    return `
      <div class="bu-detail-row ${info.className}">
        <div class="bu-detail-main">
          <strong>${detail.title || detail.label || "Pick Type"}</strong>
          <span>Actual Pick ${weightText} | Target ≥ ${target}</span>
        </div>
        <div class="bu-detail-value">${formatNumber(detail.average)}</div>
        <div class="bu-detail-foot">
          <span>${info.gapText}</span>
          <span>${formatInteger(detail.count || 0)} รายการ</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.min(info.progress, 100)}%"></div></div>
      </div>
    `;
  }).join("");

  return `<div class="bu-detail-list">${rows}</div>`;
}

function renderBuBreakdown(buItems, payload = {}) {
  if (!buGrid) {
    return;
  }

  buGrid.textContent = "";

  if (!Array.isArray(buItems) || buItems.length === 0) {
    const empty = document.createElement("article");
    empty.className = "bu-card is-empty";
    empty.textContent = "ยังไม่มีข้อมูล BU จาก API ให้ Deploy Apps Script เวอร์ชันล่าสุด แล้วกดรีเฟรชข้อมูลอีกครั้ง";
    buGrid.appendChild(empty);
    return;
  }

  buItems.forEach((item) => {
    const target = Number(item.target || TARGETS.overall);
    const info = getStatusInfo(item.average, target);
    const detailRows = renderBuDetailRows(item.details);
    const card = document.createElement("article");
    card.className = `bu-card ${info.className}${item.focus ? " is-focus" : ""}`;
    card.innerHTML = `
      <div class="bu-title-row">
        <div>
          <span>${item.focus ? "Actual : Pick" : "Other BU"}</span>
          <h3>${item.title || item.label || "BU"}</h3>
        </div>
        <strong>${info.label}</strong>
      </div>
      <div class="bu-value">-</div>
      <div class="bu-meta">
        <span>Target ≥ ${target}</span>
        <span>Share ${formatNumber(item.share || 0)}%</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(info.progress, 100)}%"></div></div>
      <div class="bu-foot">
        <span>${info.gapText}</span>
        <span>${formatInteger(item.count || 0)} รายการ</span>
      </div>
      ${getCompareNoteHtml(item.average, findByKey(payload.previousPayload?.bu, item.key)?.average, payload, "Pick/Hr", target)}
      ${detailRows}
    `;
    buGrid.appendChild(card);

    // Animate BU value count
    const valueEl = card.querySelector(".bu-value");
    animateValue(valueEl, item.average, formatNumber);
  });
}

function renderZoneBreakdown(zoneGroups, payload = {}) {
  if (!zoneBreakdownGrid) return;
  zoneBreakdownGrid.textContent = "";

  if (!Array.isArray(zoneGroups) || zoneGroups.length === 0) {
    zoneBreakdownGrid.innerHTML = `
      <div class="zone-empty">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18" stroke="#4A5568" stroke-width="2"/>
          <path d="M20 12v10M20 28v1" stroke="#4A5568" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <p>ยังไม่มีข้อมูล Zone จาก API</p>
        <small>Deploy Apps Script เวอร์ชันล่าสุด แล้วกดรีเฟรชข้อมูลอีกครั้ง</small>
      </div>`;
    return;
  }

  // ── Summary bar ที่ด้านบน (ตัวเลขรวมทุก zone ในกลุ่ม) ──
  const allZones = zoneGroups.flatMap(g => Array.isArray(g.zones) ? g.zones : []);
  const goodCount = allZones.filter(z => z.average >= (z.target || TARGETS.overall)).length;
  const warnCount = allZones.length - goodCount;

  const summaryBar = document.createElement("div");
  summaryBar.className = "zone-summary-bar";
  summaryBar.innerHTML = `
    <div class="zone-summary-stat">
      <span class="zone-summary-dot good"></span>
      <span>ผ่าน Target</span>
      <strong>${goodCount}</strong><small>Zone</small>
    </div>
    <div class="zone-summary-divider"></div>
    <div class="zone-summary-stat">
      <span class="zone-summary-dot warn"></span>
      <span>ต่ำกว่า Target</span>
      <strong>${warnCount}</strong><small>Zone</small>
    </div>
    <div class="zone-summary-divider"></div>
    <div class="zone-summary-stat">
      <span class="zone-summary-dot all"></span>
      <span>Zone ทั้งหมด</span>
      <strong>${allZones.length}</strong><small>Zone</small>
    </div>
  `;
  zoneBreakdownGrid.appendChild(summaryBar);

  // ── แต่ละกลุ่ม Zone ──
  zoneGroups.forEach((group) => {
    const section = document.createElement("div");
    section.className = "zone-section";

    const zoneRows = Array.isArray(group.zones) ? group.zones : [];
    const groupGood = zoneRows.filter(z => z.average >= (z.target || group.target || TARGETS.overall)).length;
    const groupStatusClass = groupGood === zoneRows.length ? "all-good"
      : groupGood === 0 ? "all-warn" : "partial";

    // ── Header กลุ่ม ──
    const sectionHead = document.createElement("div");
    sectionHead.className = "zone-section-head";
    sectionHead.innerHTML = `
      <div class="zone-section-title">
        <span class="zone-section-icon ${groupStatusClass}">
          ${groupStatusClass === "all-good"
            ? `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3.5 3.5 5.5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
            : `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 4v4M7 10v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
          }
        </span>
        <h3>${group.title}</h3>
      </div>
      <div class="zone-section-meta">
        <span class="zone-section-pill ${groupStatusClass}">${groupGood}/${zoneRows.length} ผ่าน Target</span>
        <span class="zone-section-target">Target ≥ ${group.target}</span>
      </div>
    `;
    section.appendChild(sectionHead);

    // ── Card grid ──
    const cardGrid = document.createElement("div");
    cardGrid.className = "zone-card-grid";

    zoneRows.forEach((zone) => {
      const info = getStatusInfo(zone.average, zone.target || group.target || 1);
      const weightLabel = typeof zone.mainKpi === "number" ? `${zone.mainKpi}%` : null;
      const progress = Math.min(info.progress, 120);
      const overTarget = info.progress > 100;

      const card = document.createElement("article");
      card.className = `zone-card ${info.className}`;
      card.innerHTML = `
        <div class="zone-card-top">
          <div class="zone-card-label">${zone.title}</div>
          <span class="zone-card-badge ${info.className}">${info.label}</span>
        </div>

        <div class="zone-card-num">${formatNumber(zone.average)}</div>
        <div class="zone-card-unit">Avg Pick/Hr</div>

        <div class="zone-card-bar-wrap">
          <div class="zone-card-bar-track">
            <div class="zone-card-bar-fill ${info.className}${overTarget ? " over" : ""}"
                 style="width:${Math.min(progress, 100)}%"></div>
            <div class="zone-card-target-line"></div>
          </div>
          <div class="zone-card-bar-labels">
            <span>0</span>
            <span>Target ${zone.target || group.target}</span>
          </div>
        </div>

        <div class="zone-card-footer">
          <span class="zone-card-gap ${info.className}">${info.gapText}</span>
          <span class="zone-card-count">${formatInteger(zone.count || 0)} รายการ</span>
        </div>
        ${getCompareNoteHtml(zone.average, findByKey(findByKey(payload.previousPayload?.zones, group.key)?.zones, zone.key)?.average, payload, "Pick/Hr", zone.target || group.target)}

        ${weightLabel ? `<div class="zone-card-weight">
          <span>Weight</span><strong>${weightLabel}</strong>
        </div>` : ""}
      `;
      cardGrid.appendChild(card);
    });

    section.appendChild(cardGrid);
    zoneBreakdownGrid.appendChild(section);
  });
}



function renderPickerBoard(kind, title, subtitle, rows, emptyText, payload = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const isTopBoard = String(kind || "").toUpperCase().includes("TOP");
  const maxAverage = Math.max(...safeRows.map((item) => Number(item.average || 0)), TARGETS.overall, 1);

  if (safeRows.length === 0) {
    return `
      <article class="picker-board is-empty">
        <div class="picker-board-head">
          <div>
            <p class="visual-card-eyebrow">${escapeHtml(kind)}</p>
            <h2 class="visual-card-title">${escapeHtml(title)}</h2>
          </div>
          <span class="status-pill is-empty">0 คน</span>
        </div>
        <div class="picker-empty-state">${escapeHtml(emptyText)}</div>
      </article>
    `;
  }

  const rowsHtml = safeRows.map((item, index) => {
    const target = Number(item.target || TARGETS.overall);
    const info = getStatusInfo(item.average, target);
    const width = Math.min((Number(item.average || 0) / maxAverage) * 100, 100);
    const sampleClass = Number(item.count || 0) < 3 ? " is-low-sample" : "";
    const rankLabel = kind === "TOP PICK" ? `#${index + 1}` : `Focus ${index + 1}`;

    return `
      <div class="picker-row ${info.className}${sampleClass}">
        <div class="picker-rank">${rankLabel}</div>
        <div class="picker-main">
          <div class="picker-person-card">
            <div class="picker-person-name">
              <span class="picker-person-label">Name</span>
              <strong>${escapeHtml(item.name || "ไม่ระบุชื่อ")}</strong>
            </div>
            <div class="picker-person-id">
              <span class="picker-person-label">User ID</span>
              <strong>${escapeHtml(item.userId || "-")}</strong>
            </div>
          </div>
          <div class="picker-meta-line">
            <span class="picker-meta-zone"><b>Zone</b> ${escapeHtml(item.mainZone || "ไม่ระบุ Zone")}</span>
            <span><b>Shift</b> ${escapeHtml(item.mainShift || "ไม่ระบุกะ")}</span>
            <span><b>สังกัด</b> ${escapeHtml(item.mainAffiliation || "ไม่ระบุสังกัด")}</span>
            <span><b>BU</b> ${escapeHtml(item.mainBu || "-")}</span>
            <span><b>Type</b> ${escapeHtml(item.mainPickType || "-")}</span>
          </div>
          <div class="picker-bar-track">
            <i class="${info.className}" style="width:${width}%"></i>
          </div>
        </div>
        <div class="picker-score">
          <div class="picker-score-block">
            <strong>${formatNumber(item.average)}</strong>
            <span>Productivity</span>
          </div>
          <div class="picker-score-block picker-score-block-secondary">
            <strong>${formatInteger(item.totalPick || 0)}</strong>
            <span>Total pick</span>
          </div>
          <div class="picker-score-gap ${info.className}">${info.gapText}</div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <article class="picker-board ${isTopBoard ? "is-top" : "is-bottom"}">
      <div class="picker-board-head">
        <div>
          <p class="visual-card-eyebrow">${escapeHtml(kind)}</p>
          <h2 class="visual-card-title">${escapeHtml(title)}</h2>
          <small>${escapeHtml(subtitle)}</small>
        </div>
        <span class="status-pill ${isTopBoard ? "is-good" : "is-warning"}">${safeRows.length} คน</span>
      </div>
      <div class="picker-list">${rowsHtml}</div>
    </article>
  `;
}

function renderPickerRankings(pickers, payload = {}) {
  if (!pickerGrid) return;

  const summary = normalizePickerSummary(pickers);
  pickerGrid.innerHTML = `
    ${renderPickerBoard("TOP PICK", "คนที่ทำ Productivity สูงสุด", "เรียงจาก Avg Pick/Hr สูงไปต่ำ ใช้ Column AF", summary.top, "ยังไม่มีข้อมูล Top Pick", payload)}
    ${renderPickerBoard("BOTTOM PICK", "คนที่ควรโฟกัสก่อน", "เรียงจาก Avg Pick/Hr ต่ำไปสูง เพื่อใช้ติดตามรายคน", summary.bottom, "ยังไม่มีข้อมูล Bottom Pick", payload)}
  `;
}
function renderTrainingBreakdown(trainingItems, payload = {}) {
  if (!trainingGrid) {
    return;
  }

  const items = Array.isArray(trainingItems) ? trainingItems : [];
  renderTrainingSummaryCards(items);
  renderTrainingTrendChart(items);
  renderTrainingFocusList(items);
  trainingGrid.textContent = "";

  if (items.length === 0) {
    const empty = document.createElement("article");
    empty.className = "training-card is-empty";
    empty.textContent = "ยังไม่มีข้อมูล Training จาก Sheet Update name ที่จับกับ Results Master ด้วย User ID";
    trainingGrid.appendChild(empty);
    return;
  }

  items.slice(0, 100).forEach((item) => {
    const improvement = Number(item.improvement || 0);
    const firstAverage = Number(item.first30Average || 0);
    const secondAverage = Number(item.second30Average || 0);
    const target = Number(item.target || TARGETS.training);
    const targetGap = Number(item.average || 0) - target;
    const targetInfo = getStatusInfo(item.average, target);
    const isBelowTrainingTarget = Number(item.count || 0) > 0 && targetGap < 0;
    const maxAverage = Math.max(firstAverage, secondAverage, target, 1);
    const firstWidth = Math.min((firstAverage / maxAverage) * 100, 100);
    const secondWidth = Math.min((secondAverage / maxAverage) * 100, 100);
    const trendInfo = getTrainingTrendInfo(item);
    const card = document.createElement("article");
    card.className = `training-card ${trendInfo.className}`;
    card.innerHTML = `
      <div class="training-title-row">
        <div>
          <span>Training</span>
          <h3>${item.name || "ไม่ระบุชื่อ"}</h3>
          <small>${item.userId ? `User ID: ${item.userId}` : ""}</small>
        </div>
        <strong>${trendInfo.label}</strong>
      </div>

      <div class="training-score-row">
        <div>
          <span>Avg Pick/Hr</span>
          <strong>${formatNumber(item.average)}</strong>
        </div>
        <div class="${isBelowTrainingTarget ? "is-danger-box" : ""}">
          <span>Target ${target}</span>
          <strong>${Number(item.count || 0) > 0 ? formatSignedNumber(targetGap) : "-"}</strong>
        </div>
      </div>

      ${isBelowTrainingTarget ? `<div class="training-alert">ต่ำกว่า Target Training ${target} · ควรโฟกัส/ติดตามเพิ่ม</div>` : ""}

      <div class="training-meta">
        <span>${item.startDate || "-"} ถึง ${item.trainingEndDate || "-"}</span>
        <span>${formatInteger(item.activeDays || 0)} วัน / ${formatInteger(item.count || 0)} รายการ</span>
        ${item.smartApplied ? `<span>เดิม: ${item.originalStartDate || "-"} ถึง ${item.originalTrainingEndDate || "-"}</span>` : ""}
      </div>

      <div class="training-trend-bars" aria-label="Training trend bars">
        <div class="training-trend-row">
          <span>30 วันแรก</span>
          <div><i style="width:${firstWidth}%"></i></div>
          <strong>${formatNumber(firstAverage)}</strong>
        </div>
        <div class="training-trend-row is-later">
          <span>30 วันหลัง</span>
          <div><i style="width:${secondWidth}%"></i></div>
          <strong>${formatNumber(secondAverage)}</strong>
        </div>
      </div>

      <div class="training-foot">
        <span>${item.smartNote || trendInfo.message}</span>
        <strong>${item.smartApplied ? "Smart" : targetInfo.label}</strong>
      </div>
      ${getCompareNoteHtml(item.average, findPreviousTraining(payload, item)?.average, payload, "Pick/Hr", target)}
    `;
    trainingGrid.appendChild(card);
  });
}
function getDailyIndexCacheKey() {
  return `${DASHBOARD_CACHE_PREFIX}:dailyIndex`;
}

function createRawBucket() {
  return { sum: 0, count: 0 };
}

function addRawBucket(target, source) {
  if (!target || !source) {
    return;
  }

  target.sum += Number(source.sum || 0);
  target.count += Number(source.count || 0);
}

function createRawCategorySummary() {
  return {
    fullRack: createRawBucket(),
    halfRack: createRawBucket(),
    ea: createRawBucket(),
    pickToSort: createRawBucket(),
  };
}

function createRawZoneSummary() {
  return ZONE_GROUPS.reduce((summary, group) => {
    summary[group.key] = group.zones.reduce((zoneSummary, zone) => {
      zoneSummary[zone.key] = createRawBucket();
      return zoneSummary;
    }, {});
    return summary;
  }, {});
}

function createRawBuSummary() {
  return BU_GROUPS.reduce((summary, bu) => {
    summary[bu.key] = {
      ...createRawBucket(),
      details: createRawCategorySummary(),
    };
    return summary;
  }, {});
}

function createRawPickToSortSummary() {
  return {
    overall: createRawBucket(),
    totalPick: 0,
    shifts: {},
    bu: createRawBuSummary(),
    pickers: createRawPickerSummary(),
  };
}

function createRawPickerSummary() {
  return {};
}

function normalizeRawPickerKey(item, fallbackKey) {
  return String(item?.userId || fallbackKey || item?.name || "").trim();
}

function mergeCountMap(target, source) {
  Object.keys(source || {}).forEach((key) => {
    target[key] = Number(target[key] || 0) + Number(source[key] || 0);
  });
}

function mergePickerSummary(targetPickers, sourcePickers) {
  Object.keys(sourcePickers || {}).forEach((sourceKey) => {
    const source = sourcePickers[sourceKey] || {};
    const key = normalizeRawPickerKey(source, sourceKey);

    if (!key) {
      return;
    }

    if (!targetPickers[key]) {
      targetPickers[key] = {
        userId: source.userId || "",
        name: source.name || source.userId || "ไม่ระบุชื่อ",
        sum: 0,
        count: 0,
        totalPick: 0,
        shifts: {},
        affiliations: {},
        bu: {},
        pickTypes: {},
        zones: {},
      };
    }

    const target = targetPickers[key];
    target.sum += Number(source.sum || 0);
    target.count += Number(source.count || 0);
    target.totalPick += Number(source.totalPick || 0);

    if (source.name && (!target.name || /^User ID/i.test(target.name))) {
      target.name = source.name;
    }

    mergeCountMap(target.shifts, source.shifts);
    mergeCountMap(target.affiliations, source.affiliations);
    mergeCountMap(target.bu, source.bu);
    mergeCountMap(target.pickTypes, source.pickTypes);
    mergeCountMap(target.zones, source.zones);
  });
}

function topCountLabel(map, fallback) {
  const keys = Object.keys(map || {});

  if (keys.length === 0) {
    return fallback || "-";
  }

  return keys.sort((left, right) => {
    const countDiff = Number(map[right] || 0) - Number(map[left] || 0);
    return countDiff || left.localeCompare(right, "th");
  })[0];
}

function finalizeRawPickers(rawPickers, target = TARGETS.overall) {
  const rows = Object.keys(rawPickers || {}).map((key) => {
    const item = rawPickers[key] || {};
    const count = Number(item.count || 0);
    const average = count > 0 ? Number(item.sum || 0) / count : 0;

    return {
      key,
      userId: item.userId || "",
      name: item.name || item.userId || "ไม่ระบุชื่อ",
      average: round1(average),
      count,
      totalPick: Math.round(Number(item.totalPick || 0)),
      target,
      gap: round1(average - target),
      status: average >= target ? "ผ่าน Target" : "ต่ำกว่า Target",
      mainShift: topCountLabel(item.shifts, "ไม่ระบุกะ"),
      mainAffiliation: topCountLabel(item.affiliations, "ไม่ระบุสังกัด"),
      mainBu: topCountLabel(item.bu, "-"),
      mainPickType: topCountLabel(item.pickTypes, "-"),
      mainZone: topCountLabel(item.zones, "ไม่ระบุ Zone"),
    };
  }).filter((item) => item.count > 0);

  const addRank = (items) => items.map((item, index) => ({ ...item, rank: index + 1 }));
  const top = rows.slice().sort((left, right) => Number(right.average || 0) - Number(left.average || 0) || Number(right.count || 0) - Number(left.count || 0) || left.name.localeCompare(right.name, "th"));
  const bottom = rows.slice().sort((left, right) => Number(left.average || 0) - Number(right.average || 0) || Number(right.count || 0) - Number(left.count || 0) || left.name.localeCompare(right.name, "th"));

  return {
    total: rows.length,
    top: addRank(top.slice(0, 10)),
    bottom: addRank(bottom.slice(0, 10)),
  };
}
function createCombinedDailySummary() {
  return {
    filteredRows: 0,
    excludedCount: 0,
    totalPick: 0,
    overall: createRawBucket(),
    categories: createRawCategorySummary(),
    zones: createRawZoneSummary(),
    bu: createRawBuSummary(),
    shifts: {},
    training: createRawTrainingSummary(),
    pickers: createRawPickerSummary(),
    pickToSortDetails: createRawPickToSortSummary(),
  };
}

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function finalizeRawBucket(bucket, target, totalRows = 0, excludedCount = 0) {
  const count = Number(bucket?.count || 0);
  const average = count > 0 ? Number(bucket.sum || 0) / count : 0;

  return {
    average: round1(average),
    count,
    validCount: count,
    totalRows: totalRows || count,
    excludedCount: excludedCount || 0,
    target,
    gap: round1(average - target),
    status: average >= target ? "ผ่าน Target" : "ต่ำกว่า Target",
  };
}

function mergeShiftSummary(targetShifts, sourceShifts) {
  Object.keys(sourceShifts || {}).forEach((shiftName) => {
    const sourceShift = sourceShifts[shiftName] || {};

    if (!targetShifts[shiftName]) {
      targetShifts[shiftName] = { bucket: createRawBucket(), affiliations: {} };
    }

    addRawBucket(targetShifts[shiftName].bucket, sourceShift.bucket);

    Object.keys(sourceShift.affiliations || {}).forEach((affiliationName) => {
      if (!targetShifts[shiftName].affiliations[affiliationName]) {
        targetShifts[shiftName].affiliations[affiliationName] = createRawBucket();
      }

      addRawBucket(targetShifts[shiftName].affiliations[affiliationName], sourceShift.affiliations[affiliationName]);
    });
  });
}

function mergePickToSortSummary(target, source) {
  if (!target || !source) {
    return;
  }

  addRawBucket(target.overall, source.overall);
  target.totalPick += Number(source.totalPick || 0);
  mergeShiftSummary(target.shifts, source.shifts || {});

  BU_GROUPS.forEach((bu) => {
    addRawBucket(target.bu[bu.key], source.bu?.[bu.key]);
  });

  mergePickerSummary(target.pickers, source.pickers || {});
}

function mergeDailySummary(combined, day, dateKey = "") {
  combined.filteredRows += Number(day.filteredRows || 0);
  combined.excludedCount += Number(day.excludedCount || 0);
  combined.totalPick += Number(day.totalPick || 0);
  addRawBucket(combined.overall, day.overall);

  Object.keys(combined.categories).forEach((key) => {
    if (!shouldCountPickTypeOnDate(key, dateKey)) {
      return;
    }

    addRawBucket(combined.categories[key], day.categories?.[key]);
  });

  ZONE_GROUPS.forEach((group) => {
    group.zones.forEach((zone) => {
      addRawBucket(combined.zones[group.key][zone.key], day.zones?.[group.key]?.[zone.key]);
    });
  });

  BU_GROUPS.forEach((bu) => {
    addRawBucket(combined.bu[bu.key], day.bu?.[bu.key]);

    PICK_TYPE_DETAILS.forEach((detail) => {
      if (!shouldCountPickTypeOnDate(detail.key, dateKey)) {
        return;
      }

      addRawBucket(combined.bu[bu.key].details[detail.key], day.bu?.[bu.key]?.details?.[detail.key]);
    });
  });

  mergeShiftSummary(combined.shifts, day.shifts || {});
  if (shouldCountPickTypeOnDate("pickToSort", dateKey)) {
    mergePickToSortSummary(combined.pickToSortDetails, day.pickToSortDetails || {});
  }
  mergeTrainingSummary(combined.training, day.training || {});
  mergePickerSummary(combined.pickers, day.pickers || {});
}

function finalizeDailyZones(rawZones) {
  return ZONE_GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    target: group.target,
    zones: group.zones.map((zone) => ({
      key: zone.key,
      title: zone.title,
      label: zone.label,
      mainKpi: typeof zone.mainKpi === "number" ? zone.mainKpi : null,
      ...finalizeRawBucket(rawZones[group.key][zone.key], group.target),
    })),
  }));
}

function finalizeDailyBu(rawBu) {
  const totalCount = BU_GROUPS.reduce((sum, bu) => sum + Number(rawBu[bu.key]?.count || 0), 0);

  return BU_GROUPS.map((bu) => ({
    key: bu.key,
    title: bu.title,
    label: bu.label,
    focus: bu.focus,
    share: totalCount > 0 ? round1((Number(rawBu[bu.key]?.count || 0) / totalCount) * 100) : 0,
    details: bu.focus
      ? PICK_TYPE_DETAILS.map((detail) => ({
        key: detail.key,
        title: detail.title,
        label: detail.label,
        mainKpi: typeof bu.pickMix?.[detail.key] === "number" ? bu.pickMix[detail.key] : null,
        ...finalizeRawBucket(rawBu[bu.key].details[detail.key], detail.target),
      }))
      : [],
    ...finalizeRawBucket(rawBu[bu.key], TARGETS.overall),
  }));
}

function finalizeDailyPickToSortBu(rawBu) {
  const totalCount = BU_GROUPS.reduce((sum, bu) => sum + Number(rawBu[bu.key]?.count || 0), 0);

  return BU_GROUPS.map((bu) => ({
    key: bu.key,
    title: bu.title,
    label: bu.label,
    focus: bu.focus,
    share: totalCount > 0 ? round1((Number(rawBu[bu.key]?.count || 0) / totalCount) * 100) : 0,
    ...finalizeRawBucket(rawBu[bu.key], TARGETS.pickToSort),
  }));
}

function finalizeDailyPickToSortDetails(rawDetails) {
  const source = rawDetails || createRawPickToSortSummary();

  return {
    overall: finalizeRawBucket(source.overall, TARGETS.pickToSort),
    totalPick: Math.round(Number(source.totalPick || 0)),
    shifts: finalizeDailyShifts(source.shifts, TARGETS.pickToSort),
    bu: finalizeDailyPickToSortBu(source.bu),
    pickers: finalizeRawPickers(source.pickers, TARGETS.pickToSort),
    startDate: "08/06/2026",
    sourceColumn: "AK",
  };
}

function finalizeDailyShifts(rawShifts, target = TARGETS.overall) {
  const shiftNames = Object.keys(rawShifts || {}).sort((left, right) => left.localeCompare(right, "th"));
  const totalCount = shiftNames.reduce((sum, shiftName) => sum + Number(rawShifts[shiftName].bucket?.count || 0), 0);

  return shiftNames.map((shiftName, index) => {
    const item = rawShifts[shiftName];
    const affiliationNames = Object.keys(item.affiliations || {}).sort((left, right) => {
      const countDiff = Number(item.affiliations[right]?.count || 0) - Number(item.affiliations[left]?.count || 0);
      return countDiff || left.localeCompare(right, "th");
    });

    return {
      key: `shift${index + 1}`,
      title: `Shift ${shiftName}`,
      label: shiftName,
      share: totalCount > 0 ? round1((Number(item.bucket?.count || 0) / totalCount) * 100) : 0,
      affiliations: affiliationNames.map((affiliationName, affiliationIndex) => ({
        key: `shift${index + 1}_affiliation${affiliationIndex + 1}`,
        title: affiliationName,
        label: affiliationName,
        ...finalizeRawBucket(item.affiliations[affiliationName], target),
      })),
      ...finalizeRawBucket(item.bucket, target),
    };
  });
}


function createRawTrainingSummary() {
  return {};
}

function toIsoDateKey(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const text = value.trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (iso) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }

    const dmy = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);

    if (dmy) {
      const day = dmy[1].padStart(2, "0");
      const month = dmy[2].padStart(2, "0");
      let year = Number(dmy[3]);

      if (year < 100) year += 2000;
      if (year > 2400) year -= 543;

      return `${year}-${month}-${day}`;
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDaysToKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(date.getDate() + days);
  return toIsoDateKey(date);
}

function addMonthsToKey(dateKey, months) {
  const date = new Date(`${dateKey}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setMonth(date.getMonth() + months);
  return toIsoDateKey(date);
}

function isoToDmy(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "-";
}

function seedTrainingSummaryFromRoster(targetTraining, rosterItems) {
  const items = Array.isArray(rosterItems)
    ? rosterItems
    : Object.keys(rosterItems || {}).map((key) => ({ key, ...(rosterItems[key] || {}) }));

  items.forEach((item) => {
    const userId = String(item.userId || item.key || item.name || "").trim();

    if (!userId) {
      return;
    }

    if (!targetTraining[userId]) {
      targetTraining[userId] = {
        userId,
        name: item.name || `User ID ${userId}`,
        startDate: toIsoDateKey(item.startDate),
        endDate: toIsoDateKey(item.endDate),
        daily: {},
      };
    }
  });
}

function mergeTrainingSummary(targetTraining, sourceTraining) {
  Object.keys(sourceTraining || {}).forEach((name) => {
    const source = sourceTraining[name] || {};

    if (!targetTraining[name]) {
      targetTraining[name] = {
        userId: source.userId || name,
        name: source.name || name,
        startDate: "",
        endDate: "",
        daily: {},
      };
    }

    const target = targetTraining[name];
    const sourceStart = toIsoDateKey(source.startDate);
    const sourceEnd = toIsoDateKey(source.endDate);

    if (sourceStart && (!target.startDate || sourceStart < target.startDate)) {
      target.startDate = sourceStart;
    }

    if (sourceEnd && (!target.endDate || sourceEnd > target.endDate)) {
      target.endDate = sourceEnd;
    }

    Object.keys(source.daily || {}).forEach((dateKey) => {
      if (!target.daily[dateKey]) {
        target.daily[dateKey] = createRawBucket();
      }

      addRawBucket(target.daily[dateKey], source.daily[dateKey]);
    });
  });
}

function finalizeTrainingFromRaw(rawTraining) {
  return Object.keys(rawTraining || {}).map((name) => {
    const trainee = rawTraining[name] || {};
    const dailyKeys = Object.keys(trainee.daily || {}).sort();
    const startKey = trainee.startDate || dailyKeys[0] || "";
    const twoMonthEnd = startKey ? addMonthsToKey(startKey, 2) : "";
    const endKey = trainee.endDate && twoMonthEnd
      ? (trainee.endDate < twoMonthEnd ? trainee.endDate : twoMonthEnd)
      : (trainee.endDate || twoMonthEnd || dailyKeys[dailyKeys.length - 1] || "");
    const firstEnd = startKey ? addDaysToKey(startKey, 29) : "";
    const overall = createRawBucket();
    const first = createRawBucket();
    const second = createRawBucket();
    let activeDays = 0;

    dailyKeys.forEach((dateKey) => {
      if ((startKey && dateKey < startKey) || (endKey && dateKey > endKey)) {
        return;
      }

      const bucket = trainee.daily[dateKey];

      if (Number(bucket?.count || 0) <= 0) {
        return;
      }

      activeDays += 1;
      addRawBucket(overall, bucket);

      if (firstEnd && dateKey <= firstEnd) {
        addRawBucket(first, bucket);
      } else {
        addRawBucket(second, bucket);
      }
    });

    const firstAverage = first.count > 0 ? first.sum / first.count : 0;
    const secondAverage = second.count > 0 ? second.sum / second.count : 0;
    const average = overall.count > 0 ? overall.sum / overall.count : 0;
    const improvement = first.count > 0 && second.count > 0 ? secondAverage - firstAverage : 0;

    return {
      key: trainee.userId || name,
      userId: trainee.userId || name,
      name: trainee.name || name,
      startDate: isoToDmy(startKey),
      trainingEndDate: isoToDmy(endKey),
      activeDays,
      count: overall.count,
      average: round1(average),
      first30Average: round1(firstAverage),
      first30Count: first.count,
      second30Average: round1(secondAverage),
      second30Count: second.count,
      improvement: round1(improvement),
      trend: improvement > 0 ? "ดีขึ้น" : improvement < 0 ? "ลดลง" : "ทรงตัว/ข้อมูลยังไม่พอ",
    };
  }).sort((left, right) => {
    const dataDiff = Number(right.count > 0) - Number(left.count > 0);
    const improveDiff = Number(right.improvement || 0) - Number(left.improvement || 0);
    return dataDiff || improveDiff || left.name.localeCompare(right.name, "th");
  })
    .slice(0, 100);
}

function getIsoMonthKey(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-\d{2}$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function hasDailyIndexDataInMonth(indexPayload, monthKey) {
  if (!monthKey) {
    return false;
  }

  return (Array.isArray(indexPayload?.dateKeys) ? indexPayload.dateKeys : []).some((dateKey) => {
    const day = indexPayload.dates?.[dateKey] || {};
    return dateKey.indexOf(`${monthKey}-`) === 0 && Number(day.overall?.count || 0) > 0;
  });
}

function getLatestDailyIndexDateKey(indexPayload) {
  return (Array.isArray(indexPayload?.dateKeys) ? indexPayload.dateKeys : [])
    .filter((dateKey) => Number(indexPayload.dates?.[dateKey]?.overall?.count || 0) > 0)
    .sort()
    .pop() || "";
}

function buildMonthlyProductivityTrendFromDailyIndex(indexPayload, selectedKeys) {
  const requestedKey = (Array.isArray(selectedKeys) && selectedKeys.length > 0 ? selectedKeys[selectedKeys.length - 1] : "")
    || startDateInput.value
    || endDateInput.value
    || "";
  let anchorKey = requestedKey;
  const requestedMonthKey = getIsoMonthKey(requestedKey);

  if (!hasDailyIndexDataInMonth(indexPayload, requestedMonthKey)) {
    anchorKey = getLatestDailyIndexDateKey(indexPayload) || requestedKey || toIsoDateKey(new Date());
  }

  const anchorMatch = String(anchorKey || toIsoDateKey(new Date())).match(/^(\d{4})-(\d{2})-\d{2}$/);
  const year = anchorMatch ? Number(anchorMatch[1]) : new Date().getFullYear();
  const monthIndex = anchorMatch ? Number(anchorMatch[2]) - 1 : new Date().getMonth();
  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 0);
  const daysInMonth = endDate.getDate();
  const days = [];
  let previousAverage = null;
  let totalSum = 0;
  let totalCount = 0;
  let totalPick = 0;
  let activeDays = 0;
  let peakDay = null;
  let lowDay = null;

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const date = new Date(year, monthIndex, dayNumber);
    const dateKey = toIsoDateKey(date);
    const dayPayload = indexPayload.dates?.[dateKey] || {};
    const bucket = dayPayload.overall || {};
    const count = Number(bucket.count || 0);
    const hasData = count > 0;
    const rawAverage = hasData ? Number(bucket.sum || 0) / count : 0;
    const average = hasData ? round1(rawAverage) : null;
    let change = null;
    let trend = "none";

    if (hasData) {
      activeDays += 1;
      totalSum += Number(bucket.sum || 0);
      totalCount += count;
      totalPick += Number(dayPayload.totalPick || 0);

      if (previousAverage !== null) {
        change = round1(rawAverage - previousAverage);
        trend = change > 0 ? "up" : change < 0 ? "down" : "flat";
      }

      previousAverage = rawAverage;

      if (!peakDay || rawAverage > peakDay.rawAverage) {
        peakDay = { date: dateKey, dateLabel: isoToDmy(dateKey), productivity: average, rawAverage };
      }

      if (!lowDay || rawAverage < lowDay.rawAverage) {
        lowDay = { date: dateKey, dateLabel: isoToDmy(dateKey), productivity: average, rawAverage };
      }
    }

    days.push({
      date: dateKey,
      dateLabel: isoToDmy(dateKey),
      day: dayNumber,
      productivity: average,
      count,
      totalPick: Math.round(Number(dayPayload.totalPick || 0)),
      hasData,
      change,
      trend,
    });
  }

  if (peakDay) delete peakDay.rawAverage;
  if (lowDay) delete lowDay.rawAverage;

  return {
    month: getIsoMonthKey(toIsoDateKey(startDate)),
    monthLabel: new Intl.DateTimeFormat("th-TH", { month: "short", year: "numeric" }).format(startDate),
    startDate: isoToDmy(toIsoDateKey(startDate)),
    endDate: isoToDmy(toIsoDateKey(endDate)),
    metricLabel: "Avg Pick/Hr",
    sourceColumn: "Results Master!C / AF",
    average: totalCount > 0 ? round1(totalSum / totalCount) : null,
    activeDays,
    totalPick: Math.round(totalPick),
    peakDay,
    lowDay,
    days,
  };
}

function buildDashboardFromDailyIndex(indexPayload, filterStartDate = null, filterEndDate = null) {
  const dateKeys = Array.isArray(indexPayload?.dateKeys) ? indexPayload.dateKeys : [];

  if (selectedRange === "latest" && filterStartDate === null && filterEndDate === null && (!startDateInput.value || !endDateInput.value)) {
    const latestDate = dateKeys[dateKeys.length - 1];
    if (latestDate) {
      setDateFilterToSingleDay(latestDate);
    }
  }

  const startDate = filterStartDate !== null ? filterStartDate : (startDateInput.value || "");
  const endDate = filterEndDate !== null ? filterEndDate : (endDateInput.value || "");
  const selectedKeys = dateKeys.filter((dateKey) => {
    if (startDate && dateKey < startDate) {
      return false;
    }

    if (endDate && dateKey > endDate) {
      return false;
    }

    return true;
  });
  const combined = createCombinedDailySummary();
  const trainingCombined = createRawTrainingSummary();
  seedTrainingSummaryFromRoster(trainingCombined, indexPayload.trainingRoster || []);

  selectedKeys.forEach((dateKey) => {
    mergeDailySummary(combined, indexPayload.dates?.[dateKey] || {}, dateKey);
  });

  dateKeys.forEach((dateKey) => {
    mergeTrainingSummary(trainingCombined, indexPayload.dates?.[dateKey]?.training || {});
  });

  return {
    ok: true,
    generatedAt: indexPayload.generatedAt || new Date().toISOString(),
    elapsedMs: 0,
    cacheStatus: "client-instant",
    cacheVersion: DASHBOARD_CACHE_PREFIX,
    range: {
      startDate,
      endDate,
    },
    overall: finalizeRawBucket(combined.overall, TARGETS.overall, combined.filteredRows, combined.excludedCount),
    categories: {
      fullRack: finalizeRawBucket(combined.categories.fullRack, TARGETS.fullRack),
      halfRack: finalizeRawBucket(combined.categories.halfRack, TARGETS.halfRack),
      ea: finalizeRawBucket(combined.categories.ea, TARGETS.ea),
      pickToSort: finalizeRawBucket(combined.categories.pickToSort, TARGETS.pickToSort),
    },
    zones: finalizeDailyZones(combined.zones),
    bu: finalizeDailyBu(combined.bu),
    shifts: finalizeDailyShifts(combined.shifts),
    training: finalizeTrainingFromRaw(trainingCombined),
    monthlyTrend: buildMonthlyProductivityTrendFromDailyIndex(indexPayload, selectedKeys),
    pickers: finalizeRawPickers(combined.pickers),
    pickToSortDetails: finalizeDailyPickToSortDetails(combined.pickToSortDetails),
    totalPick: combined.totalPick,
    totalPickRange: {
      startDate: selectedKeys.length > 0 ? isoToDmy(selectedKeys[0]) : "",
      endDate: selectedKeys.length > 0 ? isoToDmy(selectedKeys[selectedKeys.length - 1]) : "",
      sourceColumn: "C",
    },
    totalRows: combined.filteredRows,
    filteredRows: combined.filteredRows,
    filterDiagnostics: {
      enabled: Boolean(startDate || endDate),
      sourceColumn: "C",
      sourceFormat: "DD/MM/YYYY",
      matchedDateRows: selectedKeys.length,
      emptyDateRows: indexPayload.emptyDateRows || 0,
      invalidDateRows: indexPayload.invalidDateRows || 0,
    },
    excludedSamples: [],
  };
}

function renderDashboardFromDailyIndex(sourceLabel = "Filter ทันทีในเครื่อง") {
  if (!dailyIndexPayload || dailyIndexPayload.ok === false || dailyIndexPayload.mode !== "dailyIndex") {
    return false;
  }

  const payload = buildDashboardFromDailyIndex(dailyIndexPayload);
  renderDashboard(payload, { sourceLabel });
  saveDashboardToLocalCache(payload);
  return true;
}

function loadDailyIndexFromLocalCache() {
  try {
    const cachedText = localStorage.getItem(getDailyIndexCacheKey());

    if (!cachedText) {
      return false;
    }

    const payload = JSON.parse(cachedText);

    if (payload?.ok && payload.mode === "dailyIndex") {
      dailyIndexPayload = payload;
      return true;
    }
  } catch (error) {
    console.warn(error);
    localStorage.removeItem(getDailyIndexCacheKey());
  }

  return false;
}

function saveDailyIndexToLocalCache(payload) {
  try {
    localStorage.setItem(getDailyIndexCacheKey(), JSON.stringify(payload));
  } catch (error) {
    console.warn(error);
  }
  try {
    idbPut(getDailyIndexCacheKey(), payload);
  } catch (error) {
    console.warn(error);
  }
}

async function loadDailyIndex(options = {}) {
  if (isDailyIndexLoading) {
    return null;
  }

  isDailyIndexLoading = true;

  try {
    const payload = await fetchJsonpDashboard({ force: Boolean(options.force), mode: "dailyIndex" }, DAILY_INDEX_TIMEOUT_MS);

    if (payload?.ok && payload.mode === "dailyIndex") {
      dailyIndexPayload = payload;
      saveDailyIndexToLocalCache(payload);

      if (options.renderAfterLoad) {
        renderDashboardFromDailyIndex("Filter เร็วพร้อมใช้");
      }
    }

    return payload;
  } catch (error) {
    console.warn("Daily index load failed", error);
    return null;
  } finally {
    isDailyIndexLoading = false;
  }
}

function getCacheLabel(payload) {
  if (payload.cacheStatus === "client-instant") {
    return "Filter ทันที";
  }

  if (payload.cacheStatus === "fresh") {
    return "ข้อมูลสด";
  }

  if (payload.cacheStatus === "memory-cache") {
    return "cache เร็ว";
  }

  if (payload.cacheStatus === "instant-cache") {
    return "cache พร้อมใช้";
  }

  if (payload.cacheStatus === "stale-cache") {
    return "cache ล่าสุดที่มี";
  }

  return "cache ในเครื่อง";
}

function getDashboardStatusText(payload, sourceLabel) {
  const generatedAt = payload.generatedAt ? formatSyncTime(new Date(payload.generatedAt)) : formatSyncTime(new Date());
  const elapsed = Number.isFinite(Number(payload.elapsedMs)) ? ` | API ${payload.elapsedMs}ms` : "";
  const age = Number.isFinite(Number(payload.cacheAgeSeconds)) ? ` | อายุ ${payload.cacheAgeSeconds}s` : "";
  const range = payload.range || {};
  const rangeText = range.startDate || range.endDate
    ? ` | Filter ${range.startDate || "เริ่มต้น"} ถึง ${range.endDate || "ล่าสุด"}`
    : "";
  const diagnostics = payload.filterDiagnostics || {};
  const noMatchText = diagnostics.enabled && Number(diagnostics.matchedDateRows || 0) === 0
    ? ` | ไม่พบวันที่ DD/MM/YYYY ใน Column C ตรงช่วงที่เลือก`
    : "";
  const trainingDebug = payload.trainingDebug || {};
  if (payload.trainingDebug) console.info("TRAINING DEBUG", payload.trainingDebug);
  const trainingText = Number.isFinite(Number(trainingDebug.trainingUserCount))
    ? ` | Training ${trainingDebug.trainingMatchedCount || 0}/${trainingDebug.trainingUserCount || 0}`
    : "";

  const targetText = ` | Target ${TARGETS.overall}/${TARGETS.fullRack}/${TARGETS.halfRack}/${TARGETS.ea}/T${TARGETS.training}`;
  return `${sourceLabel} ${generatedAt}${elapsed}${age}${rangeText}${noMatchText}${trainingText}${targetText}`;
}

function renderDashboard(rawPayload, options = {}) {
  const payload = applyCurrentTargets(normalizeDashboardPayload(rawPayload));

  if (!payload || payload.ok === false) {
    throw new Error(payload?.error || "โหลด Dashboard ไม่สำเร็จ");
  }

  if (!payload.overall || !payload.categories) {
    throw new Error("รูปแบบข้อมูล Dashboard ไม่ตรงกับหน้าเว็บ");
  }

  lastRenderedPayload = payload;

  // Fast path: render critical UI immediately for perceived speed
  updateStaticTargetLabels();
  renderOverall(payload.overall || {}, payload);
  renderMonthlyProductivityTrend(payload.monthlyTrend);
  ensureMonthlyProductivityTrend(payload);
  updateActiveDateBanner(payload, options);
  renderSnapshotOverview(payload);
  renderPresentSummary(payload);
  renderPickerRankings(payload.pickers || {}, payload);

  // Update sync status right away
  if (options.updateStatus !== false) {
    const sourceLabel = options.sourceLabel || getCacheLabel(payload);
    setSyncStatus(getDashboardStatusText(payload, sourceLabel));
  }

  // Hide loading modal early so user sees content right away
  try { hideLoadingModal(); } catch (e) {}

  // Pre-render all dashboard tab pages eagerly so that tab switching is instant
  const preRenderAllTabs = (p) => {
    try {
      clearSkeletons();
      if (categoryGrid) renderCategoryCards(p.categories || {}, p);
      if (pickToSortGrid) renderPickToSortDashboard(p);
      if (shiftGrid) renderShiftBreakdown(p.shifts || [], p);
      if (buGrid) renderBuBreakdown(p.bu || [], p);
      if (trainingGrid) renderTrainingBreakdown(p.training || [], p);
      if (pickerGrid) renderPickerRankings(p.pickers || {}, p);
      if (zoneBreakdownGrid) renderZoneBreakdown(p.zones || [], p);
    } catch (e) {
      console.warn("Pre-rendering all tabs failed", e);
    }
  };

  const doDeferred = () => {
    try { renderVisualOverview(payload); } catch (e) { console.warn(e); }
    try { preRenderAllTabs(payload); } catch (e) { console.warn(e); }
    if (payload.trainingDebug) console.log("TRAINING DEBUG", payload.trainingDebug);
  };

  if ('requestIdleCallback' in window) {
    try {
      requestIdleCallback(doDeferred, { timeout: 700 });
    } catch (e) {
      setTimeout(doDeferred, 60);
    }
  } else {
    setTimeout(doDeferred, 60);
  }

  return payload;
}

function renderDashboardFromLocalCache() {
  try {
    const cacheKey = getDashboardCacheKey();
    const cachedText = localStorage.getItem(cacheKey);
    if (!cachedText) {
      // still try to load from IndexedDB in background
      idbGet(cacheKey).then((idbPayload) => {
        if (idbPayload) renderDashboard(idbPayload, { sourceLabel: "แสดงจาก IndexedDB" });
      }).catch(() => {});
      return false;
    }

    const payload = JSON.parse(cachedText);
    renderDashboard(payload, { sourceLabel: "แสดงทันทีจากเครื่อง" });

    // try to upgrade from IndexedDB in background
    idbGet(cacheKey).then((idbPayload) => {
      if (idbPayload) {
        try {
          // if different generatedAt or elapsed, render the better one
          if (idbPayload.generatedAt && idbPayload.generatedAt !== payload.generatedAt) {
            renderDashboard(idbPayload, { sourceLabel: "แสดงจาก IndexedDB" });
          }
        } catch (e) { /* ignore */ }
      }
    }).catch(() => {});

    return true;
  } catch (error) {
    console.warn(error);
    localStorage.removeItem(getDashboardCacheKey());
    return false;
  }
}

function getCachedLatestDateInput() {
  try {
    const cachedText = localStorage.getItem(getDashboardCacheKeyForDates("", ""));

    if (!cachedText) {
      return "";
    }

    return getLatestDateInputFromPayload(JSON.parse(cachedText));
  } catch (error) {
    console.warn(error);
    return "";
  }
}

function saveDashboardToLocalCache(payload) {
  try {
    const normalized = normalizeDashboardPayload(payload);
    const cachePayload = { ...normalized };
    delete cachePayload.previousPayload;
    delete cachePayload.comparisonMeta;
    localStorage.setItem(getDashboardCacheKey(), JSON.stringify(cachePayload));
    // also persist to IndexedDB for larger/offline cache
    try { idbPut(getDashboardCacheKey(), normalized); } catch (e) { /* ignore */ }
  } catch (error) {
    console.warn(error);
  }
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  // register current request so it can be aborted externally
  currentRequest = { type: 'fetch', controller };

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    // try to stream response and report progress
    const contentLength = response.headers.get('content-length');
    if (!response.body) {
      return response.json();
    }

    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length || value.byteLength || 0;
        if (contentLength) {
          const pct = Math.min(99, (received / Number(contentLength)) * 100);
          try { setLoadingProgress(pct); } catch (e) {}
        } else {
          // heuristic - grow until near-complete
          const pct = Math.min(95, (received / 60000) * 100);
          try { setLoadingProgress(pct); } catch (e) {}
        }
      }
    }

    // concatenate
    const totalLen = chunks.reduce((s, c) => s + (c.length || c.byteLength || 0), 0);
    const tmp = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      tmp.set(c, offset);
      offset += c.length || c.byteLength || 0;
    }

    const text = new TextDecoder().decode(tmp);
    return JSON.parse(text);
  } finally {
    clearTimeout(timeoutId);
    currentRequest = null;
  }
}

function fetchJsonpDashboard(options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const callbackName = `__pickDashboard_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let timeoutId;

    function cleanup() {
      clearTimeout(timeoutId);
      try { delete window[callbackName]; } catch (e) {}
      try { script.remove(); } catch (e) {}
    }

    window[callbackName] = (payload) => {
      cleanup();
      currentRequest = null;
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      currentRequest = null;
      reject(new Error("JSONP load failed"));
    };

    timeoutId = setTimeout(() => {
      cleanup();
      currentRequest = null;
      reject(new Error("JSONP request timed out"));
    }, timeoutMs);

    script.src = getDashboardUrl({
      ...options,
      callback: callbackName,
    });
    document.head.appendChild(script);

    // register currentRequest so it can be aborted
    currentRequest = {
      type: 'jsonp',
      cleanup: cleanup,
      reject: reject,
      callbackName,
      script,
    };
  });
}

async function fetchDashboardPayload(options = {}) {
  try {
    return await fetchJsonpDashboard(options);
  } catch (firstJsonpError) {
    console.warn("JSONP failed, retrying once", firstJsonpError);

    try {
      await new Promise((resolve) => setTimeout(resolve, 650));
      return await fetchJsonpDashboard({ ...options, retry: "1" }, REQUEST_TIMEOUT_MS);
    } catch (secondJsonpError) {
      console.warn("JSONP retry failed, trying fetch fallback", secondJsonpError);

      try {
        return await fetchJsonWithTimeout(getDashboardUrl({ ...options, retry: "fetch" }), REQUEST_TIMEOUT_MS);
      } catch (fetchError) {
        throw new Error("โหลดจาก Apps Script ไม่ทัน ให้รอสักครู่แล้วกด Filter/Refresh อีกครั้ง");
      }
    }
  }
}

function setDateFilterToFullMonth(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    setDateFilterToSingleDay(dateKey);
    return;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = String(new Date(year, month, 0).getDate()).padStart(2, "0");
  const endOfMonth = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  
  if (startDateInput) startDateInput.value = startOfMonth;
  if (endDateInput) endDateInput.value = endOfMonth;
}

async function fetchLatestDashboardPayload(options = {}, discoveryPayload = null) {
  const discovery = discoveryPayload || await fetchDashboardPayload({
    force: Boolean(options.force),
    filterStartDate: "",
    filterEndDate: "",
  });
  const latestDateInput = getLatestDateInputFromPayload(normalizeDashboardPayload(discovery));

  if (!latestDateInput) {
    return {
      payload: discovery,
      latestDateInput: "",
      usedDiscoveryPayload: true,
    };
  }

  setDateFilterToSingleDay(latestDateInput);
  selectedRange = "latest";
  syncQuickFilterActiveState();
  setSyncStatus(`พบข้อมูลล่าสุดวันที่ ${toDdMmYyyyFromInput(latestDateInput)} กำลังโหลดข้อมูล...`);

  const latestPayload = await fetchDashboardPayload({
    force: Boolean(options.force),
    filterStartDate: latestDateInput,
    filterEndDate: latestDateInput,
  });

  if (!hasDashboardData(normalizeDashboardPayload(latestPayload))) {
    return {
      payload: discovery,
      latestDateInput,
      usedDiscoveryPayload: true,
    };
  }

  return {
    payload: latestPayload,
    latestDateInput,
    usedDiscoveryPayload: false,
  };
}

async function loadDashboard(options = {}) {
  const { silent = false, force = false } = options;

  if (isLoading) {
    return;
  }

  isLoading = true;

  if (refreshButton && (!silent || force)) {
    refreshButton.disabled = true;
    refreshButton.textContent = force ? "คำนวณสด..." : "กำลังรีเฟรช...";
  }

  // 1. Try to load Daily Index from LocalCache/IndexedDB first if not already loaded in memory
  if (!dailyIndexPayload) {
    loadDailyIndexFromLocalCache();
  }

  if (!dailyIndexPayload) {
    try {
      const cachedIdb = await idbGet(getDailyIndexCacheKey());
      if (cachedIdb?.ok && cachedIdb.mode === "dailyIndex") {
        dailyIndexPayload = cachedIdb;
      }
    } catch (e) {
      console.warn("IndexedDB load failed", e);
    }
  }

  // 2. If we have the Daily Index, perform fast client-side rendering
  if (dailyIndexPayload && dailyIndexPayload.ok) {
    try {
      // Calculate dashboard client-side
      let payload = buildDashboardFromDailyIndex(dailyIndexPayload);
      
      // Attach comparison client-side from the same daily index
      payload = await attachComparisonPayload(payload, { force });
      
      // Render the dashboard immediately
      const sourceLabel = selectedRange === "latest" ? "วันล่าสุด (กรองในเครื่อง)" : "กรองข้อมูลทันที (ในเครื่อง)";
      renderDashboard(payload, { sourceLabel });
      
      // Finish fast path
      isLoading = false;
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = "รีเฟรช";
      }
      
      // Now, in the background, fetch updates from the server if forced or cache is old (60s)
      const cacheAge = dailyIndexPayload.generatedAt ? (Date.now() - new Date(dailyIndexPayload.generatedAt).getTime()) / 1000 : Infinity;
      if (force || cacheAge > 60) {
        // Fetch new index silently in background
        loadDailyIndex({ force, renderAfterLoad: true }).catch(console.error);
      }
      return;
    } catch (err) {
      console.warn("Fast client rendering failed, falling back to network", err);
    }
  }

  // 3. Fallback to normal loading if no cached Daily Index is available
  try {
    if (!silent) {
      showLoadingModal(8000);
      setSyncStatus("กำลังดาวน์โหลดข้อมูลใหม่จากเซิร์ฟเวอร์...");
    }
    
    // Fetch Daily Index from server and render
    const payload = await loadDailyIndex({ force, renderAfterLoad: true });
    if (!payload || !payload.ok) {
      throw new Error("ดาวน์โหลดข้อมูลล้มเหลว");
    }
  } catch (error) {
    console.error(error);
    try { hideLoadingModal(); } catch (e) {}
    if (!renderDashboardFromLocalCache()) {
      setSyncStatus(`โหลดข้อมูลไม่สำเร็จ: ${error.message}`);
    }
  } finally {
    isLoading = false;
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.textContent = "รีเฟรช";
    }
    try { hideLoadingModal(); } catch (e) {}
  }
}

function toDateInputValue(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function getRelativeDateInputValue(dayOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return toDateInputValue(date);
}

function formatThaiLongDateFromInput(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return "ยังไม่ทราบวันที่";
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function hasDashboardData(payload) {
  if (!payload || payload.ok === false) {
    return false;
  }

  const diagnostics = payload.filterDiagnostics || {};
  const overall = payload.overall || {};
  const rowSignals = [
    payload.filteredRows,
    payload.totalRows,
    payload.totalPick,
    overall.count,
    overall.validCount,
    overall.totalRows,
    diagnostics.matchedDateRows,
  ];

  return rowSignals.some((value) => Number(value || 0) > 0);
}


function getDateKeyOffset(dateKey, dayOffset) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setDate(date.getDate() + Number(dayOffset || 0));
  return toDateInputValue(date);
}

function getDateRangeLengthDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function getComparisonRangeForCurrentFilter() {
  const start = startDateInput?.value || "";
  const end = endDateInput?.value || start;
  if (!start || !end) return null;

  const length = getDateRangeLengthDays(start, end);
  const previousEnd = getDateKeyOffset(start, -1);
  const previousStart = getDateKeyOffset(previousEnd, -(length - 1));

  return {
    startDate: previousStart,
    endDate: previousEnd,
    label: previousStart === previousEnd
      ? `เทียบกับ ${isoToDmy(previousEnd)}`
      : `เทียบกับ ${isoToDmy(previousStart)} ถึง ${isoToDmy(previousEnd)}`,
  };
}

function getCompareClass(delta) {
  const value = Number(delta || 0);
  if (value > 0) return "is-up";
  if (value < 0) return "is-down";
  return "is-flat";
}

function formatCompareDelta(delta, unit = "Pick/Hr") {
  const value = Math.round(Number(delta || 0));
  if (value > 0) return `เพิ่มขึ้น +${formatNumber(value)} ${unit}`;
  if (value < 0) return `ลดลง ${formatNumber(Math.abs(value))} ${unit}`;
  return `เท่าเดิม 0 ${unit}`;
}

function formatTargetContext(currentValue, targetValue, unit = "Pick/Hr") {
  const current = Number(currentValue || 0);
  const target = Number(targetValue || 0);

  if (!Number.isFinite(current) || current <= 0 || !Number.isFinite(target) || target <= 0) {
    return "";
  }

  const gap = Math.round(current - target);

  if (gap > 0) {
    return ` · สูงกว่า Target +${formatNumber(gap)} ${unit}`;
  }

  if (gap < 0) {
    return ` · ต่ำกว่า Target ${formatNumber(Math.abs(gap))} ${unit}`;
  }

  return ` · เท่ากับ Target`;
}

function getComparisonMeta(payload = {}) {
  return payload.comparisonMeta || {};
}

function getCompareNoteHtml(currentValue, previousValue, payload = {}, unit = "Pick/Hr", targetValue = null) {
  const meta = getComparisonMeta(payload);
  const label = meta.label || "เทียบวันก่อน";
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);
  const targetContext = targetValue ? formatTargetContext(current, targetValue, unit) : "";

  if (!payload.previousPayload) {
    return `<div class="compare-note is-empty">${label}: ยังไม่มีข้อมูลเทียบ${targetContext}</div>`;
  }

  if (!Number.isFinite(previous) || previous <= 0) {
    return `<div class="compare-note is-empty">${label}: วันก่อนยังไม่มีข้อมูล${targetContext}</div>`;
  }

  const delta = current - previous;
  return `<div class="compare-note ${getCompareClass(delta)}">${label}: ${formatCompareDelta(delta, unit)}${targetContext}</div>`;
}

function findByKey(items, key) {
  return (Array.isArray(items) ? items : []).find((item) => String(item.key || "") === String(key || ""));
}

function findByLabel(items, label) {
  const normalized = String(label || "").trim().toLowerCase();
  return (Array.isArray(items) ? items : []).find((item) => {
    const itemLabel = String(item.label || item.title || item.key || "").trim().toLowerCase();
    return itemLabel === normalized;
  });
}

function findPreviousPicker(payload, picker) {
  const previousPickers = payload?.previousPayload?.pickers || {};
  const rows = [
    ...(Array.isArray(previousPickers.top) ? previousPickers.top : []),
    ...(Array.isArray(previousPickers.bottom) ? previousPickers.bottom : []),
  ];
  const key = String(picker?.key || picker?.userId || "").trim();
  return rows.find((item) => String(item.key || item.userId || "").trim() === key);
}

function findPreviousTraining(payload, trainee) {
  const rows = payload?.previousPayload?.training || [];
  const key = String(trainee?.userId || trainee?.key || "").trim();
  return (Array.isArray(rows) ? rows : []).find((item) => String(item.userId || item.key || "").trim() === key);
}

async function attachComparisonPayload(currentPayload, options = {}) {
  const range = getComparisonRangeForCurrentFilter();
  if (!range || !range.startDate || !range.endDate) {
    return currentPayload;
  }

  if (dailyIndexPayload && dailyIndexPayload.ok) {
    try {
      const previousPayload = applyCurrentTargets(buildDashboardFromDailyIndex(dailyIndexPayload, range.startDate, range.endDate));
      return {
        ...currentPayload,
        previousPayload,
        comparisonMeta: range,
      };
    } catch (err) {
      console.warn("Client comparison failed, falling back to network", err);
    }
  }

  try {
    const previousRaw = await fetchDashboardPayload({
      force: Boolean(options.force),
      filterStartDate: range.startDate,
      filterEndDate: range.endDate,
      comparison: "previous-period",
    });
    const previousPayload = applyCurrentTargets(normalizeDashboardPayload(previousRaw));

    return {
      ...currentPayload,
      previousPayload,
      comparisonMeta: range,
    };
  } catch (error) {
    console.warn("Comparison load failed", error);
    return {
      ...currentPayload,
      comparisonMeta: range,
    };
  }
}

function setDateFilterToSingleDay(dateKey) {
  if (startDateInput) startDateInput.value = dateKey;
  if (endDateInput) endDateInput.value = dateKey;
}

function clearDateFilter() {
  if (startDateInput) startDateInput.value = "";
  if (endDateInput) endDateInput.value = "";
}

function syncQuickFilterActiveState() {
  quickFilterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.range === selectedRange);
  });
}

function updateActiveDateBanner(payload = {}, options = {}) {
  if (!activeDateBanner) return;

  const start = startDateInput?.value || payload.range?.startDate || "";
  const end = endDateInput?.value || payload.range?.endDate || start;
  const isSingleDay = start && end && start === end;
  const label = isSingleDay
    ? `วันที่ ${formatThaiLongDateFromInput(start)}`
    : getOverviewTotalPickRangeText(payload);

  activeDateLabel.textContent = label;

  if (selectedRange === "today") {
    activeDateHint.textContent = `${"ระบบเลือกข้อมูลของวันนี้ให้อัตโนมัติ"} · ${getComparisonMeta(payload).label || "เทียบกับวันก่อนหน้า"}`;
  } else if (selectedRange === "latest") {
    activeDateHint.textContent = "ระบบแสดงวันที่ล่าสุดที่มีข้อมูลจริง";
  } else if (selectedRange === "autoYesterday") {
    activeDateHint.textContent = `${"วันนี้ยังไม่มีข้อมูล ระบบจึงแสดงข้อมูลของเมื่อวานแทน"} · ${getComparisonMeta(payload).label || "เทียบกับวันก่อนหน้า"}`;
  } else if (selectedRange === "autoLatest") {
    activeDateHint.textContent = "วันนี้และเมื่อวานยังไม่มีข้อมูล ระบบจึงแสดงวันที่ล่าสุดที่มีข้อมูลแทน";
  } else if (selectedRange === "custom") {
    activeDateHint.textContent = "ช่วงวันที่ที่เลือกเอง";
  } else {
    activeDateHint.textContent = options.sourceLabel || "ช่วงข้อมูลที่กำลังแสดงอยู่";
  }

  activeDateBanner.classList.toggle("is-fallback", selectedRange === "autoYesterday" || selectedRange === "autoLatest");
}

function initializeDefaultDateFilter() {
  selectedRange = "latest";
  const cachedLatestDate = getCachedLatestDateInput();

  if (cachedLatestDate) {
    setDateFilterToSingleDay(cachedLatestDate);
    selectedRange = "latest";
  } else {
    clearDateFilter();
  }

  syncQuickFilterActiveState();
  updateActiveDateBanner({}, { sourceLabel: "กำลังค้นหาวันล่าสุดที่มีข้อมูล..." });
}

function normalizeDateFilterOrder() {
  if (startDateInput.value && endDateInput.value && startDateInput.value > endDateInput.value) {
    const originalStart = startDateInput.value;
    startDateInput.value = endDateInput.value;
    endDateInput.value = originalStart;
  }
}

function loadSelectedRange(options = {}) {
  normalizeDateFilterOrder();

  // v35: ปิดการสร้าง Daily Index ระหว่างใช้งานปกติก่อน เพราะข้อมูลเยอะแล้วทำให้ Apps Script ช้า/ค้าง
  // ให้เรียก Dashboard API ตามช่วงวันที่ที่เลือกโดยตรง จะเสถียรกว่า และ Training จะไม่โดน filter วันที่หลักอยู่แล้ว
  const showedCache = renderDashboardFromLocalCache();
  loadDashboard({ silent: showedCache, force: Boolean(options.force) });
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


  syncQuickFilterActiveState();
  updateActiveDateBanner({}, {
    sourceLabel: range === "latest"
      ? "กำลังค้นหาวันล่าสุดที่มีข้อมูล..."
      : "กำลังโหลดข้อมูลตามวันที่ที่เลือก...",
  });

  loadSelectedRange();
}

function initializeTargetSettings() {
  updateStaticTargetLabels();
  setTargetFormValues();

  targetSettingsButton?.addEventListener("click", openTargetSettings);
  targetSettingsClose?.addEventListener("click", closeTargetSettings);
  targetCloseElements.forEach((element) => {
    element.addEventListener("click", closeTargetSettings);
  });

  targetSettingsForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    updateTargets({ ...TARGETS, ...getTargetFormValues() }, "ปรับ Target แล้ว");
    closeTargetSettings();
    setSyncStatus("บันทึก Target ใหม่แล้ว");
  });

  targetSettingsReset?.addEventListener("click", () => {
    updateTargets(DEFAULT_TARGETS, "กลับค่า Target เริ่มต้น");
    setSyncStatus("กลับค่า Target เริ่มต้นแล้ว");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && targetSettingsModal && !targetSettingsModal.hidden) {
      closeTargetSettings();
    }
  });
}

presentRangeButtons.forEach((button) => {
  button.addEventListener("click", () => setQuickRange(button.dataset.presentRange));
});
quickFilterButtons.forEach((button) => {
  button.addEventListener("click", () => setQuickRange(button.dataset.range));
});

applyDateButton.addEventListener("click", () => {
  selectedRange = "custom";
  syncQuickFilterActiveState();
  updateActiveDateBanner({}, { sourceLabel: "กำลังโหลดข้อมูลตามวันที่ที่เลือก..." });
  loadSelectedRange();
});

function clearPickDashboardLocalCache() {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.indexOf("pickProductivityDashboardCache:") === 0) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn(error);
  }
}

refreshButton.addEventListener("click", async () => {
  dailyIndexPayload = null;
  clearPickDashboardLocalCache();
  if (selectedRange === "latest") {
    clearDateFilter();
    syncQuickFilterActiveState();
    updateActiveDateBanner({}, { sourceLabel: "กำลังค้นหาวันล่าสุดที่มีข้อมูล..." });
  } else if (selectedRange === "autoYesterday" || selectedRange === "autoLatest") {
    selectedRange = "today";
    setDateFilterToSingleDay(getRelativeDateInputValue(0));
    syncQuickFilterActiveState();
    updateActiveDateBanner({}, { sourceLabel: "กำลังตรวจสอบข้อมูลวันนี้อีกครั้ง..." });
  }
  // v35: โหลด Dashboard หลักอย่างเดียวก่อน ไม่ยิง Daily Index ซ้อน เพื่อไม่ให้เว็บช้า
  await loadDashboard({ force: true });
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadDashboard({ silent: true });
  }
});

initializeTargetSettings();
initializeDefaultDateFilter();
loadDashboard({ silent: false });

setInterval(() => {
  loadDashboard({ silent: true });
}, REFRESH_INTERVAL_MS);
