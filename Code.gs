/**
 * ============================================================================
 * KESARI CRM — GOOGLE APPS SCRIPT BACKEND
 * ============================================================================
 * Paste this whole file into Extensions > Apps Script on the Google Sheet
 * that was created by importing kesari-crm-database.xlsx (or a sheet with the
 * same tab names / headers: Guests, Leads, Enquiries, FollowUps, Bookings,
 * ServiceCalls).
 *
 * Deploy > New deployment > type "Web app"
 *    Execute as:      Me
 *    Who has access:  Anyone
 * The resulting /exec URL is what app.js calls as API_BASE_URL.
 *
 * Supported requests:
 *   GET  ?action=list&sheet=Leads[&filter_STATUS=active&filter_HUB=Mumbai...]
 *   GET  ?action=get&sheet=Leads&id=L-2001
 *   POST { action:'create', sheet:'Leads', data:{...} }
 *   POST { action:'update', sheet:'Leads', id:'L-2001', data:{...} }
 *   POST { action:'delete', sheet:'Leads', id:'L-2001' }
 *
 * The first column of every sheet is treated as its primary key
 * (GuestID / LeadID / EnquiryID / FollowUpID / BookingID / ServiceCallID).
 * ============================================================================
 */

const VALID_SHEETS = ['Guests', 'Leads', 'Enquiries', 'FollowUps', 'Bookings', 'ServiceCalls'];

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action || 'list';
    const sheetName = params.sheet;
    assertSheet(sheetName);

    if (action === 'list') return jsonOut(listRecords(sheetName, params));
    if (action === 'get') return jsonOut(getRecord(sheetName, params.id));
    return jsonOut({ error: 'Unknown GET action: ' + action });
  } catch (err) {
    return jsonOut({ error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const sheetName = body.sheet;
    assertSheet(sheetName);

    if (action === 'create') return jsonOut(createRecord(sheetName, body.data || {}));
    if (action === 'update') return jsonOut(updateRecord(sheetName, body.id, body.data || {}));
    if (action === 'delete') return jsonOut(deleteRecord(sheetName, body.id));
    return jsonOut({ error: 'Unknown POST action: ' + action });
  } catch (err) {
    return jsonOut({ error: String(err) });
  }
}

/* ---------------------------------------------------------------- helpers */

function assertSheet(name) {
  if (VALID_SHEETS.indexOf(name) === -1) {
    throw new Error('Unknown sheet: ' + name + '. Valid: ' + VALID_SHEETS.join(', '));
  }
}

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet tab not found: ' + name);
  return sheet;
}

function headersOf_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function rowsAsObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const obj = {};
    headers.forEach((h, c) => { obj[h] = values[i][c]; });
    obj.__row = i + 1; // 1-based sheet row, for internal use
    out.push(obj);
  }
  return { headers, rows: out };
}

/* ------------------------------------------------------------------- CRUD */

function listRecords(sheetName, params) {
  const sheet = getSheet_(sheetName);
  const { headers, rows } = rowsAsObjects_(sheet);
  let filtered = rows;

  // Any query param named filter_<Column> does an exact (case-insensitive) match.
  Object.keys(params).forEach((key) => {
    if (key.indexOf('filter_') === 0) {
      const col = key.substring('filter_'.length);
      const val = String(params[key]).toLowerCase();
      filtered = filtered.filter((r) => String(r[col] || '').toLowerCase() === val);
    }
  });
  // Free-text search across all columns via ?q=
  if (params.q) {
    const q = String(params.q).toLowerCase();
    filtered = filtered.filter((r) => headers.some((h) => String(r[h] || '').toLowerCase().indexOf(q) !== -1));
  }

  filtered.forEach((r) => delete r.__row);
  return { sheet: sheetName, headers, count: filtered.length, rows: filtered };
}

function getRecord(sheetName, id) {
  const sheet = getSheet_(sheetName);
  const { headers, rows } = rowsAsObjects_(sheet);
  const idCol = headers[0];
  const found = rows.find((r) => String(r[idCol]) === String(id));
  if (!found) return { error: 'Not found', id };
  delete found.__row;
  return { sheet: sheetName, row: found };
}

function createRecord(sheetName, data) {
  const sheet = getSheet_(sheetName);
  const headers = headersOf_(sheet);
  const idCol = headers[0];
  if (!data[idCol]) {
    data[idCol] = generateId_(sheetName);
  }
  const row = headers.map((h) => (data[h] !== undefined ? data[h] : ''));
  sheet.appendRow(row);
  return { success: true, id: data[idCol] };
}

function updateRecord(sheetName, id, data) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      headers.forEach((h, c) => {
        if (data[h] !== undefined) sheet.getRange(i + 1, c + 1).setValue(data[h]);
      });
      return { success: true, id };
    }
  }
  return { success: false, error: 'Not found', id };
}

function deleteRecord(sheetName, id) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true, id };
    }
  }
  return { success: false, error: 'Not found', id };
}

function generateId_(sheetName) {
  const prefix = {
    Guests: 'G', Leads: 'L', Enquiries: 'E', FollowUps: 'FU', Bookings: 'B', ServiceCalls: 'SC',
  }[sheetName] || 'X';
  return prefix + '-' + new Date().getTime().toString().slice(-8);
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
