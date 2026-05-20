const RESULTS_API_URL = "https://script.google.com/macros/s/AKfycbyby7nOGMZe-w8pph0IZ7jz9WqQ17pwFhfW4TdWgoi1PJlkvXhYuNzHav48WBNsOkcGjg/exec";
const REFRESH_INTERVAL_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 45000;
const DAILY_INDEX_TIMEOUT_MS = 45000;
const DASHBOARD_CACHE_PREFIX = "pickProductivityDashboardCache:v36-training-target-100";
const TARGET_STORAGE_KEY = "pickProductivityTargets:v1";

const DEFAULT_TARGETS = Object.freeze({
  overall: 170,
  fullRack: 170,
  halfRack: 200,
  ea: 170,
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

const PICK_TYPE_DETAILS = [
  { key: "fullRack", title: "Picking Productivity - Full Rack (หยิบ)", label: "Full Rack", target: TARGETS.fullRack },
  { key: "halfRack", title: "Picking Productivity - Half Rack (หยิบ)", label: "Half Rack", target: TARGETS.halfRack },
  { key: "ea", title: "Picking Productivity - EA(หยิบ)", label: "EA", target: TARGETS.ea },
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

const overallCard = document.querySelector("#overallCard");
const overallAverage = document.querySelector("#overallAverage");
const overallStatus = document.querySelector("#overallStatus");
const overallGap = document.querySelector("#overallGap");
const overallProgress = document.querySelector("#overallProgress");
const validRows = document.querySelector("#validRows");
const totalRows = document.querySelector("#totalRows");
const excludedRows = document.querySelector("#excludedRows");
const categoryGrid = document.querySelector("#categoryGrid");
const shiftGrid = document.querySelector("#shiftGrid");
const buGrid = document.querySelector("#buGrid");
const zoneBreakdownGrid = document.querySelector("#zoneBreakdownGrid");
const trainingGrid = document.querySelector("#trainingGrid");
const snapshotGrid = document.querySelector("#snapshotGrid");
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

let selectedRange = "all";
let isLoading = false;
let dailyIndexPayload = null;
let isDailyIndexLoading = false;

function toDdMmYyyyFromInput(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return "";
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
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

  if (startDateInput.value) {
    url.searchParams.set("startDate", startDateInput.value);
    url.searchParams.set("startDateDMY", toDdMmYyyyFromInput(startDateInput.value));
  }

  if (endDateInput.value) {
    url.searchParams.set("endDate", endDateInput.value);
    url.searchParams.set("endDateDMY", toDdMmYyyyFromInput(endDateInput.value));
  }

  url.searchParams.set("dateFormat", "DMY");

  return url.toString();
}

function getDashboardCacheKey() {
  return [
    DASHBOARD_CACHE_PREFIX,
    startDateInput.value || "all",
    endDateInput.value || "all",
  ].join(":");
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

function formatInteger(value) {
  return new Intl.NumberFormat("th-TH").format(Number(value) || 0);
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
      needsZoneApiUpdate: !Array.isArray(payload.zones),
      needsBuApiUpdate: !Array.isArray(payload.bu),
      needsShiftApiUpdate: !Array.isArray(payload.shifts),
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
    },
    zones: [],
    bu: [],
    shifts: [],
    training: [],
    totalRows: validRows,
    filteredRows: validRows,
    excludedSamples: [],
  };
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
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
  
  setText(gaugeInsight, `${info.gapText} จาก ${formatInteger(summary.validCount || 0)} รายการที่นำมาเฉลี่ย`);

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
  if (!snapshotGrid) return;

  const overall = payload.overall || {};
  const overallInfo = getStatusInfo(overall.average, TARGETS.overall);
  const categoryItems = CATEGORY_CONFIG.map((config) => {
    const data = payload.categories?.[config.key] || {};
    const average = Number(data.average || 0);
    return {
      label: config.shortTitle,
      average,
      target: config.target,
      ratio: config.target > 0 ? average / config.target : 0,
    };
  }).sort((left, right) => left.ratio - right.ratio);
  const weakestCategory = categoryItems[0] || { label: "-", average: 0, target: 0 };
  const shiftItems = Array.isArray(payload.shifts) ? payload.shifts.slice().filter((item) => Number(item.count || 0) > 0) : [];
  const weakestShift = shiftItems.sort((left, right) => Number(left.average || 0) - Number(right.average || 0))[0];
  const trainingSummary = summarizeTraining(payload.training || []);
  const trainingRate = percentOf(trainingSummary.improved + trainingSummary.onTarget, Math.max(trainingSummary.withData, 1));

  const cards = [
    {
      className: overallInfo.className,
      label: "Overall",
      value: formatNumber(overall.average),
      note: overallInfo.gapText,
    },
    {
      className: weakestCategory.average >= weakestCategory.target ? "is-good" : "is-warning",
      label: "โฟกัส Rack / EA",
      value: weakestCategory.label,
      note: `Avg ${formatNumber(weakestCategory.average)} / Target ${weakestCategory.target}`,
    },
    {
      className: weakestShift && Number(weakestShift.average || 0) >= TARGETS.overall ? "is-good" : "is-warning",
      label: "โฟกัส Shift",
      value: weakestShift ? (weakestShift.label || weakestShift.title || "ไม่ระบุกะ") : "-",
      note: weakestShift ? `Avg ${formatNumber(weakestShift.average)} จาก ${formatInteger(weakestShift.count || 0)} รายการ` : "ยังไม่มีข้อมูล Shift",
    },
    {
      className: trainingRate >= 60 ? "is-good" : trainingRate > 0 ? "is-warning" : "is-empty",
      label: "Training ดีขึ้น/ผ่านเป้า",
      value: `${trainingRate}%`,
      note: `${formatInteger(trainingSummary.improved + trainingSummary.onTarget)} จาก ${formatInteger(trainingSummary.withData)} คนที่มีข้อมูล`,
    },
  ];

  snapshotGrid.innerHTML = cards.map((card) => `
    <article class="snapshot-card ${card.className}">
      <span>${card.label}</span>
      <strong>${card.value}</strong>
      <small>${card.note}</small>
    </article>
  `).join("");
}


function getPresentRangeLabel() {
  const start = startDateInput?.value ? toDdMmYyyyFromInput(startDateInput.value) : "";
  const end = endDateInput?.value ? toDdMmYyyyFromInput(endDateInput.value) : "";

  if (selectedRange === "week") return "Weekly Summary";
  if (selectedRange === "month") return "Monthly Summary";
  if (selectedRange === "today") return "Today Summary";
  if (selectedRange === "custom" && (start || end)) return `${start || "เริ่มต้น"} ถึง ${end || "ล่าสุด"}`;
  return "All Data Summary";
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
  const presentRange = getPresentRangeLabel();
  const periodClass = getPresentPeriodClass();
  const overallGapText = overallAverage >= TARGETS.overall
    ? `สูงกว่า Target ${formatNumber(overallAverage - TARGETS.overall)} Pick/Hr`
    : `ต่ำกว่า Target ${formatNumber(TARGETS.overall - overallAverage)} Pick/Hr`;
  const mainFocus = weakestCategory
    ? `${weakestCategory.label} Avg ${formatNumber(weakestCategory.average)} / Target ${weakestCategory.target}`
    : "ยังไม่มีข้อมูล Rack / EA";

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

  setText(
    presentNarrative,
    `ภาพรวมช่วง ${presentRange} อยู่ที่ Avg ${formatNumber(overallAverage)} Pick/Hr (${overallGapText}). จุดโฟกัสหลักคือ ${mainFocus}. ${shiftSentence}. ${trainingSentence}.`
  );

  const kpiCards = [
    { label: "Overall", value: formatNumber(overallAverage), note: overallGapText, className: overallInfo.className },
    { label: "Rack / EA ที่ควรโฟกัส", value: weakestCategory?.label || "-", note: weakestCategory ? `ต่ำ/สูงกว่าเป้า ${formatSignedNumber(weakestCategory.gap)}` : "ยังไม่มีข้อมูล", className: weakestCategory && weakestCategory.gap >= 0 ? "is-good" : "is-warning" },
    { label: "Shift ที่ควรดู", value: weakestShift ? (weakestShift.label || weakestShift.title || "-") : "-", note: weakestShift ? `Avg ${formatNumber(weakestShift.average)} · ${formatInteger(weakestShift.count || 0)} รายการ` : "ยังไม่มีข้อมูล", className: weakestShift && Number(weakestShift.average || 0) >= TARGETS.overall ? "is-good" : "is-warning" },
    { label: "Training ดีขึ้น/ผ่านเป้า", value: `${trainingPositiveRate}%`, note: `${formatInteger(trainingPositive)} จาก ${formatInteger(trainingSummary.withData)} คน`, className: trainingPositiveRate >= 60 ? "is-good" : trainingPositiveRate > 0 ? "is-warning" : "is-empty" },
    { label: "Zone ต่ำกว่าเป้า", value: formatInteger(weakZones.length), note: weakZones[0] ? `${weakZones[0].label} ต่ำสุด` : "ไม่มี Zone ต่ำกว่าเป้า", className: weakZones.length > 0 ? "is-warning" : "is-good" },
    { label: "BU Focus", value: focusBu ? (focusBu.label || focusBu.title || "BU") : "-", note: focusBu ? `Avg ${formatNumber(focusBu.average)} · Share ${formatNumber(focusBu.share || 0)}%` : "ยังไม่มีข้อมูล Punthai/Mart", className: focusBu && Number(focusBu.average || 0) >= TARGETS.overall ? "is-good" : "is-warning" },
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
  ];

  const risks = [
    overallAverage < TARGETS.overall ? `Overall ยังต่ำกว่า Target ${TARGETS.overall} อยู่ ${formatNumber(TARGETS.overall - overallAverage)} Pick/Hr` : "Overall ผ่าน Target ภาพรวมแล้ว ให้รักษาระดับและดูจุดย่อยต่อ",
    weakestCategory && weakestCategory.gap < 0 ? `${weakestCategory.label} ต่ำกว่า Target มากสุดในกลุ่ม Rack / EA (${formatNumber(Math.abs(weakestCategory.gap))} Pick/Hr)` : "Rack / EA ไม่มีประเภทหลักที่ต่ำกว่าเป้าในช่วงนี้",
    weakZones.length > 0 ? `Zone ที่ควรดูแรกคือ ${weakZones[0].label} Avg ${formatNumber(weakZones[0].average)} ต่ำกว่า Target ${formatNumber(Math.abs(weakZones[0].gap))}` : "Zone ส่วนใหญ่ไม่มีสัญญาณต่ำกว่าเป้า",
    trainingSummary.belowTarget > 0 ? `Training ต่ำกว่า Target ${TARGETS.training} จำนวน ${formatInteger(trainingSummary.belowTarget)} คน` : `Training ไม่มีคนที่ต่ำกว่า Target ${TARGETS.training} จากข้อมูลที่มี`,
  ];

  const actions = [
    weakestCategory && weakestCategory.gap < 0 ? `ให้หัวหน้างานเริ่มจาก ${weakestCategory.label} เพราะเป็นจุดที่ดึงค่า Overall ลงมากที่สุด` : "ใช้ข้อมูลนี้เป็น baseline แล้วติดตามซ้ำในรอบถัดไป",
    weakestShift ? `รีวิววิธีทำงานของ ${weakestShift.label || weakestShift.title || "Shift ที่ต่ำสุด"} เทียบกับกะที่ทำได้ดีที่สุด` : "รอข้อมูล Shift เพิ่มก่อนตัดสินใจเชิงปฏิบัติการ",
    weakZones.length > 0 ? `เปิดดูหน้า Zone เพื่อเจาะ ${weakZones.slice(0, 3).map((zone) => zone.label).join(" / ")} ก่อน` : "ใช้หน้า Zone เพื่อติดตามต่อว่าพื้นที่ไหนเริ่มหลุดเป้า",
    trainingSummary.belowTarget > 0 ? "ให้ Training list เป็นรายการ follow-up รายบุคคลในรอบประชุมถัดไป" : "รักษาแนวโน้ม Training และเพิ่มตัวอย่าง Best Practice จากคนที่ดีขึ้น",
  ];

  renderPresentList(presentHighlights, highlights, "ยังไม่มีข้อมูลจุดเด่นสำหรับช่วงนี้");
  renderPresentList(presentRisks, risks, "ยังไม่มีความเสี่ยงสำคัญจากข้อมูลช่วงนี้");
  renderPresentList(presentActions, actions, "ยังไม่มีข้อเสนอเพิ่มเติม");

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
function renderOverall(summary) {
  const info = getStatusInfo(summary.average, TARGETS.overall);

  overallCard.classList.remove("is-good", "is-warning", "is-empty");
  overallCard.classList.add(info.className);
  overallAverage.textContent = formatNumber(summary.average);
  overallStatus.textContent = info.label;
  overallGap.textContent = info.gapText;
  overallProgress.style.width = `${Math.min(info.progress, 100)}%`;
  validRows.textContent = formatInteger(summary.validCount || 0);
  totalRows.textContent = formatInteger(summary.totalRows || 0);
  excludedRows.textContent = `ตัดออก ${formatInteger(summary.excludedCount || 0)} รายการ`;

  // อัพเดต Sidebar KPI mini
  const sidebarOverall = document.querySelector("#sidebarOverall");
  const sidebarProgress = document.querySelector("#sidebarProgress");
  const sidebarStatus = document.querySelector("#sidebarStatus");
  if (sidebarOverall) sidebarOverall.textContent = formatNumber(summary.average);
  if (sidebarProgress) sidebarProgress.style.width = `${Math.min(info.progress, 100)}%`;
  if (sidebarStatus) {
    sidebarStatus.textContent = info.label;
    sidebarStatus.style.color = info.className === "is-good" ? "var(--good)" : info.className === "is-warning" ? "var(--warn)" : "var(--text-muted)";
  }
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
        <span>${formatInteger(data.count || 0)} รายการ</span>
      </div>
    `;
    categoryGrid.appendChild(card);
  });
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

function renderShiftBreakdown(shifts) {
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
      <div class="shift-value">${formatNumber(item.average)}</div>
      <div class="shift-meta">
        <span>Target ≥ ${target}</span>
        <span>Share ${formatNumber(item.share || 0)}%</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(info.progress, 100)}%"></div></div>
      <div class="shift-foot">
        <span>${info.gapText}</span>
        <span>${formatInteger(item.count || 0)} รายการ</span>
      </div>
      ${affiliationRows}
    `;
    shiftGrid.appendChild(card);
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

function renderBuBreakdown(buItems) {
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
      <div class="bu-value">${formatNumber(item.average)}</div>
      <div class="bu-meta">
        <span>Target ≥ ${target}</span>
        <span>Share ${formatNumber(item.share || 0)}%</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(info.progress, 100)}%"></div></div>
      <div class="bu-foot">
        <span>${info.gapText}</span>
        <span>${formatInteger(item.count || 0)} รายการ</span>
      </div>
      ${detailRows}
    `;
    buGrid.appendChild(card);
  });
}

function renderZoneBreakdown(zoneGroups) {
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
  const goodCount = allZones.filter(z => z.average >= (z.target || 170)).length;
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
    const groupGood = zoneRows.filter(z => z.average >= (z.target || group.target || 170)).length;
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


function renderTrainingBreakdown(trainingItems) {
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

function createCombinedDailySummary() {
  return {
    filteredRows: 0,
    excludedCount: 0,
    overall: createRawBucket(),
    categories: createRawCategorySummary(),
    zones: createRawZoneSummary(),
    bu: createRawBuSummary(),
    shifts: {},
    training: createRawTrainingSummary(),
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

function mergeDailySummary(combined, day) {
  combined.filteredRows += Number(day.filteredRows || 0);
  combined.excludedCount += Number(day.excludedCount || 0);
  addRawBucket(combined.overall, day.overall);

  Object.keys(combined.categories).forEach((key) => {
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
      addRawBucket(combined.bu[bu.key].details[detail.key], day.bu?.[bu.key]?.details?.[detail.key]);
    });
  });

  mergeShiftSummary(combined.shifts, day.shifts || {});
  mergeTrainingSummary(combined.training, day.training || {});
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

function finalizeDailyShifts(rawShifts) {
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
        ...finalizeRawBucket(item.affiliations[affiliationName], TARGETS.overall),
      })),
      ...finalizeRawBucket(item.bucket, TARGETS.overall),
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

function buildDashboardFromDailyIndex(indexPayload) {
  const dateKeys = Array.isArray(indexPayload?.dateKeys) ? indexPayload.dateKeys : [];
  const startDate = startDateInput.value || "";
  const endDate = endDateInput.value || "";
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
    mergeDailySummary(combined, indexPayload.dates?.[dateKey] || {});
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
    },
    zones: finalizeDailyZones(combined.zones),
    bu: finalizeDailyBu(combined.bu),
    shifts: finalizeDailyShifts(combined.shifts),
    training: finalizeTrainingFromRaw(trainingCombined),
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

  updateStaticTargetLabels();
  renderOverall(payload.overall || {});
  renderSnapshotOverview(payload);
  renderPresentSummary(payload);
  renderVisualOverview(payload);
  renderCategoryCards(payload.categories || {});
  renderShiftBreakdown(payload.shifts || []);
  renderBuBreakdown(payload.bu || []);
  renderTrainingBreakdown(payload.training || []);

  if (payload.trainingDebug) {
    console.log("TRAINING DEBUG", payload.trainingDebug);
  }

  renderZoneBreakdown(payload.zones || []);

  if (options.updateStatus !== false) {
    const sourceLabel = options.sourceLabel || getCacheLabel(payload);
    setSyncStatus(getDashboardStatusText(payload, sourceLabel));
  }

  return payload;
}

function renderDashboardFromLocalCache() {
  try {
    const cachedText = localStorage.getItem(getDashboardCacheKey());

    if (!cachedText) {
      return false;
    }

    const payload = JSON.parse(cachedText);
    renderDashboard(payload, { sourceLabel: "แสดงทันทีจากเครื่อง" });
    return true;
  } catch (error) {
    console.warn(error);
    localStorage.removeItem(getDashboardCacheKey());
    return false;
  }
}

function saveDashboardToLocalCache(payload) {
  try {
    localStorage.setItem(getDashboardCacheKey(), JSON.stringify(normalizeDashboardPayload(payload)));
  } catch (error) {
    console.warn(error);
  }
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function fetchJsonpDashboard(options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const callbackName = `__pickDashboard_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let timeoutId;

    function cleanup() {
      clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP load failed"));
    };

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("JSONP request timed out"));
    }, timeoutMs);

    script.src = getDashboardUrl({
      ...options,
      callback: callbackName,
    });
    document.head.appendChild(script);
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

  if (!silent) {
    setSyncStatus(force ? "กำลังคำนวณข้อมูลสดจาก Results Master..." : "กำลังดึง Dashboard จาก cache...");
  }

  try {
    const payload = await fetchDashboardPayload({ force });
    const normalizedPayload = renderDashboard(payload);
    saveDashboardToLocalCache(normalizedPayload);
  } catch (error) {
    console.error(error);

    if (!renderDashboardFromLocalCache()) {
      setSyncStatus(`โหลดข้อมูลไม่สำเร็จ: ${error.message}`);
    }
  } finally {
    isLoading = false;

    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.textContent = "รีเฟรช";
    }
  }
}

function toDateInputValue(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
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


quickFilterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.range === selectedRange);
  });

  loadSelectedRange();
}

presentRangeButtons.forEach((button) => {
  button.addEventListener("click", () => setQuickRange(button.dataset.presentRange));
});
quickFilterButtons.forEach((button) => {
  button.addEventListener("click", () => setQuickRange(button.dataset.range));
});

applyDateButton.addEventListener("click", () => {
  selectedRange = "custom";
  quickFilterButtons.forEach((button) => button.classList.remove("active"));
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
  // v35: โหลด Dashboard หลักอย่างเดียวก่อน ไม่ยิง Daily Index ซ้อน เพื่อไม่ให้เว็บช้า
  await loadDashboard({ force: true });
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadDashboard({ silent: true });
  }
});

// v35: ไม่โหลด Daily Index ตอนเปิดเว็บ เพื่อลดเวลารอและลดโอกาส Apps Script timeout
dailyIndexPayload = null;
const showedInitialCache = renderDashboardFromLocalCache();
loadDashboard({ silent: showedInitialCache });

setInterval(() => {
  loadDashboard({ silent: true });
}, REFRESH_INTERVAL_MS);