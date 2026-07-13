/* =====================================================================================
   KESARI CRM — DATA & API LAYER  (data-api.js)
   ---------------------------------------------------------------------------
   This file is the ONLY place that talks to Google Sheets. Everything else
   (app-logic.js) works with plain JS "lead" objects and never touches fetch()
   or raw sheet column names directly.

   BACKING SHEET (per what you shared):
   https://docs.google.com/spreadsheets/d/1W0EVw29X8YFvDpeu_umYQFwYEqeMBWTRWtmCNhEM9WA/edit
   Tab name: "Leads"
   Columns (exact, in order):
     Lead_ID, Customer_Name, Mobile, Email, Lead_Source, Campaign, Inquiry_Text,
     Destination, Tour_Zone, Tour_Sector, Hub, Assigned_To, Status, Priority,
     Attempts, Last_Attempt, Last_Activity, Follow_Up_Date, Date_Received,
     Adults, Children, Budget, Travel_Date, Pin_Code, Remarks, Lead_Owner,
     Created_By, Updated_At

   ⚠️ IMPORTANT ABOUT THE URL YOU SENT
   The link you pasted:
     https://script.googleusercontent.com/macros/echo?user_content_key=...&lib=...
   is a one-off "echo" output URL from the Apps Script editor's debugger / a
   bound library reference — it is NOT a stable Web App endpoint. It can expire
   and it does not reliably accept POST (create/update/delete) calls the way a
   real deployment does.

   For live read/write you need a proper Web App deployment:
     1. Open the Google Sheet → Extensions → Apps Script
     2. Paste in the Code.gs provided alongside this file
     3. Deploy → New deployment → type "Web app"
          Execute as:     Me
          Who has access: Anyone
     4. Copy the resulting URL (ends in /exec) and paste it below as API_BASE_URL.

   Until you do that, CONFIG.API_BASE_URL below is set to the link you gave us,
   so GET (read) calls will attempt it — but writes (No Answer / Convert /
   Follow-up outcomes / etc.) will only succeed once you swap in a real /exec
   URL. The app will still work and show a clear toast if a write fails.
===================================================================================== */

const CONFIG = {
  // 👉 Your deployed Apps Script Web App "/exec" URL:
  API_BASE_URL: 'https://script.google.com/macros/s/AKfycbxN5VBVL1lrPd8MUdXI9MJB4di28kFXwhZp8edf4PYifAZ2bkphUH_xpgazepCoga6mhQ/exec',
  SHEET_NAME: 'Leads',
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1W0EVw29X8YFvDpeu_umYQFwYEqeMBWTRWtmCNhEM9WA/edit',
};

/* ---------------------------------------------------------------- low-level fetch */

async function apiGet(action, params = {}) {
  const qs = new URLSearchParams({ action, sheet: CONFIG.SHEET_NAME, ...params }).toString();
  const url = `${CONFIG.API_BASE_URL}${CONFIG.API_BASE_URL.includes('?') ? '&' : '?'}${qs}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`API GET failed (${res.status})`);
  return res.json();
}

async function apiPost(action, payload = {}) {
  const res = await fetch(CONFIG.API_BASE_URL, {
    method: 'POST',
    // text/plain avoids a CORS preflight against Apps Script deployments
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, sheet: CONFIG.SHEET_NAME, ...payload }),
  });
  if (!res.ok) throw new Error(`API POST failed (${res.status})`);
  return res.json();
}

/* ---------------------------------------------------------------- field mapping */
// Sheet row (real columns) → internal Lead object used everywhere in app-logic.js

function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
function toDateInputValue(val) {
  const d = safeDate(val);
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}
function formatMobile(m) {
  const s = String(m || '').replace(/\D/g, '');
  if (s.length !== 10) return s ? `+91 ${s}` : '';
  return `+91 ${s.slice(0, 5)} ${s.slice(5)}`;
}

function rowToLead(row) {
  return {
    id: row.Lead_ID,
    name: row.Customer_Name || 'Unknown',
    mobile: String(row.Mobile || ''),
    mobileDisplay: formatMobile(row.Mobile),
    email: row.Email || '',
    source: row.Lead_Source || 'Other',
    campaign: row.Campaign || '',
    originalInquiry: row.Inquiry_Text || '',
    destination: row.Destination || '',
    tourZone: row.Tour_Zone || '',
    tourSector: row.Tour_Sector || '',
    hub: row.Hub || '',
    assignedTo: row.Assigned_To || 'Unassigned',
    status: row.Status || 'New',
    priority: row.Priority || 'Medium',
    attempts: Number(row.Attempts) || 0,
    lastAttempt: safeDate(row.Last_Attempt),
    lastActivity: row.Last_Activity || '',
    followUpDate: safeDate(row.Follow_Up_Date),
    dateReceived: safeDate(row.Date_Received) || new Date(),
    adults: Number(row.Adults) || 0,
    children: Number(row.Children) || 0,
    budget: row.Budget || '',
    travelDate: toDateInputValue(row.Travel_Date),
    pincode: row.Pin_Code ? String(row.Pin_Code) : '',
    remarks: row.Remarks || '',
    owner: row.Lead_Owner || '',
    createdBy: row.Created_By || '',
    updatedAt: safeDate(row.Updated_At),
    // client-only / not persisted to the sheet:
    callDuration: 0,
    callActive: false,
    qualifying: {
      pincode: row.Pin_Code ? String(row.Pin_Code) : '',
      tourZone: row.Tour_Zone || '',
      tourSector: row.Tour_Sector || '',
      destination: row.Destination || '',
      adults: Number(row.Adults) || 0,
      children: Number(row.Children) || 0,
      travelDate: toDateInputValue(row.Travel_Date),
      budget: row.Budget || '',
    },
  };
}

// Internal patch (partial, camelCase-ish keys) → real sheet column keys, for writes.
const FIELD_TO_COLUMN = {
  name: 'Customer_Name', mobile: 'Mobile', email: 'Email', source: 'Lead_Source',
  campaign: 'Campaign', originalInquiry: 'Inquiry_Text', destination: 'Destination',
  tourZone: 'Tour_Zone', tourSector: 'Tour_Sector', hub: 'Hub', assignedTo: 'Assigned_To',
  status: 'Status', priority: 'Priority', attempts: 'Attempts', lastAttempt: 'Last_Attempt',
  lastActivity: 'Last_Activity', followUpDate: 'Follow_Up_Date', dateReceived: 'Date_Received',
  adults: 'Adults', children: 'Children', budget: 'Budget', travelDate: 'Travel_Date',
  pincode: 'Pin_Code', remarks: 'Remarks', owner: 'Lead_Owner', createdBy: 'Created_By',
  updatedAt: 'Updated_At',
};

function patchToRow(patch) {
  const row = {};
  Object.keys(patch).forEach((k) => {
    const col = FIELD_TO_COLUMN[k];
    if (!col) return;
    let v = patch[k];
    if (v instanceof Date) v = v.toISOString();
    row[col] = v;
  });
  return row;
}

/* ---------------------------------------------------------------- public API */

async function fetchAllLeads() {
  const data = await apiGet('list');
  if (data.error) throw new Error(data.error);
  return (data.rows || []).map(rowToLead);
}

async function createLeadRemote(leadFields) {
  const row = patchToRow(leadFields);
  const data = await apiPost('create', { data: row });
  if (data.error) throw new Error(data.error);
  return data.id;
}

async function updateLeadRemote(id, patch) {
  const row = patchToRow(patch);
  const data = await apiPost('update', { id, data: row });
  if (data.error || data.success === false) throw new Error(data.error || 'Update failed');
  return true;
}

async function deleteLeadRemote(id) {
  const data = await apiPost('delete', { id });
  if (data.error || data.success === false) throw new Error(data.error || 'Delete failed');
  return true;
}

/* Fire-and-forget wrapper: applies the patch locally (already done by caller),
   pushes it to the sheet, and toasts success/failure so every click's outcome
   is visible — this is what makes "click No Answer" actually persist. */
async function persist(id, patch, successMsg) {
  try {
    await updateLeadRemote(id, { ...patch, updatedAt: new Date() });
    if (successMsg) toast(successMsg, 'success');
    return true;
  } catch (err) {
    toast(`⚠ Could not save to Google Sheets: ${err.message}. Change is only local for now.`, 'default');
    console.error('persist() failed', err);
    return false;
  }
}
