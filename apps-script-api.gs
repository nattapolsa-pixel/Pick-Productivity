const SPREADSHEET_ID = "1PMnlyYHswnV0nE73Alxh-ocIFtTipB9LMzACdNM9GFs";
const SHEET_NAME = "Results Master";
const COMPACT_COLUMNS = ["Name", "Date", "User ID", "Total pick"];
const AVERAGE_PICK_HR_COLUMN_INDEX = 31; // Column AF, 0-based index

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const useDashboardPayload = String(params.dashboard || "").toLowerCase() === "true";
    const useFullPayload = String(params.full || "").toLowerCase() === "true";
    const payload = useDashboardPayload
      ? buildDashboardPayload_(params)
      : useFullPayload
        ? buildFullResultsPayload_(params)
        : buildCompactResultsPayload_(params);

    return ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        error: error.message || String(error),
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function buildDashboardPayload_(params) {
  const sheet = getResultsSheet_();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) {
    return {
      ok: true,
      mode: "dashboard",
      spreadsheetId: SPREADSHEET_ID,
      sheetName: SHEET_NAME,
      overall: buildMetricSummary_([]),
      categories: buildCategorySummaries_({ fullRack: [], halfRack: [], ea: [] }),
      excludedSamples: [],
    };
  }

  const displayValues = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
  const headers = makeUniqueHeaders_(displayValues[0]);
  const dateIndex = findFirstHeaderIndex_(headers, ["Date", "วันที่", "Pick Date", "Work Date", "Actual Date"]);
  const nameIndex = findFirstHeaderIndex_(headers, ["Name", "ชื่อ", "ชื่อพนักงาน", "Employee Name"]);
  const userIdIndex = findFirstHeaderIndex_(headers, ["User ID", "UserID", "Employee ID", "รหัสพนักงาน"]);
  const totalPickIndex = findFirstHeaderIndex_(headers, ["Total pick", "Total Pick", "Total Picking", "ยอดหยิบ", "จำนวนหยิบ"]);
  const categoryIndexes = findCategoryHeaderIndexes_(headers);
  const startDate = parseDateInput_(params.startDate);
  const endDate = parseDateInput_(params.endDate, true);

  const validRows = [];
  const excludedRows = [];
  const categoryRows = {
    fullRack: [],
    halfRack: [],
    ea: [],
  };
  let totalRowsInRange = 0;

  for (let rowIndex = 1; rowIndex < displayValues.length; rowIndex += 1) {
    const row = displayValues[rowIndex];

    if (row.every((cell) => cell === "")) {
      continue;
    }

    const rowDate = dateIndex >= 0 ? parseFlexibleDate_(row[dateIndex]) : null;

    if (!isWithinDateRange_(rowDate, startDate, endDate)) {
      continue;
    }

    totalRowsInRange += 1;

    const averageValueText = row[AVERAGE_PICK_HR_COLUMN_INDEX] || "";
    const averagePickHr = parseNumber_(averageValueText);
    const rowInfo = {
      date: dateIndex >= 0 ? row[dateIndex] : "",
      name: nameIndex >= 0 ? row[nameIndex] : "",
      userId: userIdIndex >= 0 ? row[userIdIndex] : "",
      totalPick: totalPickIndex >= 0 ? row[totalPickIndex] : "",
      averagePickHr: averageValueText,
    };

    if (!Number.isFinite(averagePickHr) || averagePickHr <= 0) {
      excludedRows.push(Object.assign({}, rowInfo, {
        reason: averageValueText === "" ? "Column AF ว่าง" : "Column AF เป็น 0 หรือไม่ใช่ตัวเลข",
      }));
      continue;
    }

    validRows.push(averagePickHr);

    const category = detectCategory_(row, categoryIndexes);

    if (category && categoryRows[category]) {
      categoryRows[category].push(averagePickHr);
    }
  }

  return {
    ok: true,
    mode: "dashboard",
    spreadsheetId: SPREADSHEET_ID,
    sheetName: SHEET_NAME,
    averageSource: "Results Master Column AF",
    rules: "Average excludes 0, blank, and non-numeric AF values.",
    filters: {
      startDate: params.startDate || "",
      endDate: params.endDate || "",
    },
    overall: Object.assign(buildMetricSummary_(validRows), {
      totalRows: totalRowsInRange,
      excludedCount: excludedRows.length,
    }),
    categories: buildCategorySummaries_(categoryRows),
    excludedSamples: excludedRows.slice(0, 10),
  };
}

function buildMetricSummary_(values) {
  const cleaned = values.filter((value) => Number.isFinite(value) && value > 0);
  const sum = cleaned.reduce((total, value) => total + value, 0);
  const average = cleaned.length ? sum / cleaned.length : 0;

  return {
    average: roundNumber_(average, 2),
    count: cleaned.length,
    validCount: cleaned.length,
    sum: roundNumber_(sum, 2),
  };
}

function buildCategorySummaries_(categoryRows) {
  return {
    fullRack: Object.assign(buildMetricSummary_(categoryRows.fullRack || []), {
      title: "Picking Productivity - Full Rack (หยิบ)",
      mainKpi: 37,
      target: 170,
    }),
    halfRack: Object.assign(buildMetricSummary_(categoryRows.halfRack || []), {
      title: "Picking Productivity - Half Rack (หยิบ)",
      mainKpi: 48,
      target: 200,
    }),
    ea: Object.assign(buildMetricSummary_(categoryRows.ea || []), {
      title: "Picking Productivity - EA (หยิบ)",
      mainKpi: 15,
      target: 170,
    }),
  };
}

function detectCategory_(row, categoryIndexes) {
  const focusedText = categoryIndexes
    .map((index) => row[index])
    .filter(Boolean)
    .join(" ");
  const scanText = focusedText || row.join(" ");
  const normalized = normalizeCategoryText_(scanText);

  if (/(\bea\b|each|ชิ้น|อีเอ)/i.test(normalized)) {
    return "ea";
  }

  if (/(half\s*rack|half|ครึ่ง)/i.test(normalized)) {
    return "halfRack";
  }

  if (/(full\s*rack|full|เต็ม)/i.test(normalized)) {
    return "fullRack";
  }

  return "";
}

function findCategoryHeaderIndexes_(headers) {
  const aliases = [
    "Type",
    "Pick Type",
    "Picking Type",
    "Rack Type",
    "Storage Type",
    "Area",
    "Zone",
    "Location Type",
    "Location",
    "Category",
    "ประเภท",
    "ประเภทงาน",
    "โซน",
    "พื้นที่",
  ];
  const indexes = [];

  headers.forEach((header, index) => {
    const normalizedHeader = normalizeHeader_(header);
    const matched = aliases.some((alias) => normalizedHeader === normalizeHeader_(alias));

    if (matched) {
      indexes.push(index);
    }
  });

  return indexes;
}

function parseNumber_(value) {
  if (typeof value === "number") {
    return value;
  }

  const normalized = String(value || "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  if (!normalized) {
    return NaN;
  }

  return Number(normalized);
}

function parseDateInput_(value, endOfDay) {
  if (!value) {
    return null;
  }

  const parts = String(value).split("-").map(Number);

  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function parseFlexibleDate_(value) {
  if (value instanceof Date) {
    return value;
  }

  const text = String(value || "").trim();

  if (!text) {
    return null;
  }

  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);

  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const thaiDateMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);

  if (thaiDateMatch) {
    let year = Number(thaiDateMatch[3]);

    if (year < 100) {
      year += 2000;
    }

    if (year > 2400) {
      year -= 543;
    }

    return new Date(year, Number(thaiDateMatch[2]) - 1, Number(thaiDateMatch[1]));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinDateRange_(rowDate, startDate, endDate) {
  if (!startDate && !endDate) {
    return true;
  }

  if (!rowDate) {
    return false;
  }

  if (startDate && rowDate < startDate) {
    return false;
  }

  if (endDate && rowDate > endDate) {
    return false;
  }

  return true;
}

function roundNumber_(value, digits) {
  const factor = Math.pow(10, digits || 0);
  return Math.round(value * factor) / factor;
}

function buildCompactResultsPayload_(params) {
  const sheet = getResultsSheet_();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) {
    return buildEmptyPayload_("compact");
  }

  const headerRow = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const columnIndexes = COMPACT_COLUMNS
    .map((columnName) => findHeaderIndex_(headerRow, columnName))
    .filter((index) => index >= 0);

  if (columnIndexes.length === 0) {
    return buildFullResultsPayload_(params);
  }

  const minColumnIndex = Math.min.apply(null, columnIndexes);
  const maxColumnIndex = Math.max.apply(null, columnIndexes);
  const rowCount = lastRow - 1;
  const compactValues = sheet
    .getRange(2, minColumnIndex + 1, rowCount, maxColumnIndex - minColumnIndex + 1)
    .getDisplayValues();

  const labels = [];

  compactValues.forEach((rowValues) => {
    const row = {};
    let hasData = false;

    COMPACT_COLUMNS.forEach((columnName) => {
      const absoluteIndex = findHeaderIndex_(headerRow, columnName);

      if (absoluteIndex < 0) {
        row[columnName] = "";
        return;
      }

      const value = rowValues[absoluteIndex - minColumnIndex] || "";
      row[columnName] = value;

      if (value !== "") {
        hasData = true;
      }
    });

    if (hasData) {
      labels.push(buildCompactLabel_(row));
    }
  });

  const page = paginate_(labels, params);

  return {
    ok: true,
    mode: "compact",
    spreadsheetId: SPREADSHEET_ID,
    sheetName: SHEET_NAME,
    total: labels.length,
    offset: page.offset,
    count: page.data.length,
    data: page.data,
  };
}

function buildFullResultsPayload_(params) {
  const sheet = getResultsSheet_();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) {
    return buildEmptyPayload_("full");
  }

  const range = sheet.getRange(1, 1, lastRow, lastColumn);
  const displayValues = range.getDisplayValues();
  const rawValues = range.getValues();
  const headers = makeUniqueHeaders_(displayValues[0]);
  const useRawValues = String(params.raw || "").toLowerCase() === "true";
  const sourceValues = useRawValues ? rawValues : displayValues;
  const rows = [];

  for (let rowIndex = 1; rowIndex < sourceValues.length; rowIndex += 1) {
    const displayRow = displayValues[rowIndex];

    if (displayRow.every((cell) => cell === "")) {
      continue;
    }

    const row = {};

    headers.forEach((header, columnIndex) => {
      const value = useRawValues
        ? normalizeValue_(sourceValues[rowIndex][columnIndex])
        : displayRow[columnIndex];

      row[header] = value;
    });

    rows.push(row);
  }

  const page = paginate_(rows, params);

  return {
    ok: true,
    mode: "full",
    spreadsheetId: SPREADSHEET_ID,
    sheetName: SHEET_NAME,
    total: rows.length,
    offset: page.offset,
    count: page.data.length,
    data: page.data,
  };
}

function getResultsSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error(`Sheet not found: ${SHEET_NAME}`);
  }

  return sheet;
}

function buildEmptyPayload_(mode) {
  return {
    ok: true,
    mode,
    spreadsheetId: SPREADSHEET_ID,
    sheetName: SHEET_NAME,
    total: 0,
    count: 0,
    data: [],
  };
}

function findHeaderIndex_(headerRow, headerName) {
  const target = normalizeHeader_(headerName);

  return headerRow.findIndex((header) => normalizeHeader_(header) === target);
}

function findFirstHeaderIndex_(headerRow, headerNames) {
  for (let index = 0; index < headerNames.length; index += 1) {
    const foundIndex = findHeaderIndex_(headerRow, headerNames[index]);

    if (foundIndex >= 0) {
      return foundIndex;
    }
  }

  return -1;
}

function normalizeHeader_(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeCategoryText_(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCompactLabel_(row) {
  return [
    row.Name,
    row.Date && `Date: ${row.Date}`,
    row["User ID"] && `User ID: ${row["User ID"]}`,
    row["Total pick"] && `Total pick: ${row["Total pick"]}`,
  ].filter(Boolean).join(" | ");
}

function paginate_(rows, params) {
  const offset = Math.max(Number(params.offset || 0), 0);
  const requestedLimit = Number(params.limit || rows.length);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(requestedLimit, 0)
    : rows.length;

  return {
    offset,
    data: rows.slice(offset, offset + limit),
  };
}

function makeUniqueHeaders_(headerRow) {
  const seen = {};

  return headerRow.map((header, index) => {
    const baseName = String(header || `Column ${index + 1}`).trim();
    seen[baseName] = (seen[baseName] || 0) + 1;

    if (seen[baseName] === 1) {
      return baseName;
    }

    return `${baseName}_${seen[baseName]}`;
  });
}

function normalizeValue_(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === undefined) {
    return null;
  }

  return value;
}
