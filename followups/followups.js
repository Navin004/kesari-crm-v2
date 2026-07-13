/* =====================================================================================
   FOLLOW-UPS PAGE LOGIC  (followups/followups.js)
   Shows Converted / Follow Up rows whose Follow_Up_Date is due or overdue.
   Outcome buttons only ever write the sheet's real Status values (Converted /
   Follow Up / Not Interested) — "Booked"/"Lost" are tagged via a Remarks prefix
   instead of inventing new Status values (see shared/shared.js).
===================================================================================== */

let LEADS = [];
let LOADING = true;
let LOAD_ERROR = null;

const AppState = { fuSubtab: null, fuSelected: null };

/* ---------------------------- BOOT ---------------------------- */
async function boot() {
  LOADING = true; LOAD_ERROR = null;
  renderNav('followups');
  render();
  try {
    LEADS = await fetchAllLeads();
    toast(`Loaded ${LEADS.length} records from Google Sheets.`, 'success');
  } catch (err) {
    LOAD_ERROR = err.message;
    toast(`⚠ Could not load from Google Sheets: ${err.message}`, 'default');
    LEADS = [];
  }
  LOADING = false;
  updateNavBadges(LEADS);
  render();
}

function render() {
  const root = document.getElementById('pageRoot');
  if (LOADING) { root.innerHTML = renderLoading(); return; }
  if (LOAD_ERROR && LEADS.length === 0) { root.innerHTML = renderErrorState(LOAD_ERROR); return; }
  root.innerHTML = renderFollowupsTab();
  root.insertAdjacentHTML('beforeend', footerNote(LEADS.length));
}

/* =====================================================================================
   FOLLOW-UPS
===================================================================================== */
function allFollowupItems() {
  return LEADS
    .filter((l) => statusIn(l.status, ENQUIRY_STATUSES) && l.followUpDate && !isWonEnquiry(l))
    .map((l) => ({ lead: l, due: l.followUpDate, overdue: isOverdue(l.followUpDate), dueToday: isToday(l.followUpDate) }))
    .sort((a, b) => (a.due || 0) - (b.due || 0));
}
function renderFollowupsTab() {
  const items = allFollowupItems();
  const overdue = items.filter((x) => x.overdue);
  const dueToday = items.filter((x) => !x.overdue && x.dueToday);
  const completedToday = LEADS.filter((l) => l.lastAttempt && isToday(l.lastAttempt) && statusIn(l.status, ENQUIRY_STATUSES)).length;
  if (!AppState.fuSubtab) AppState.fuSubtab = overdue.length ? 'overdue' : 'today';
  const list = AppState.fuSubtab === 'overdue' ? overdue : dueToday;
  const selectedItem = list.find((x) => x.lead.id === AppState.fuSelected) || list[0];

  const rows = list.map((x) => `
    <tr onclick="AppState.fuSelected='${x.lead.id}';render();" style="${selectedItem && selectedItem.lead.id === x.lead.id ? 'background:#FEFAF6;' : ''}">
      <td><div style="font-weight:700;">${x.lead.name}</div><div class="cust-sub">${x.lead.mobileDisplay}</div></td>
      <td><span class="status-pill ${cssSafe(x.lead.status)}">${x.lead.status}</span></td>
      <td>${x.lead.tourZone || '—'}</td>
      <td>${fmtDate(x.due)}</td>
      <td><span class="status-pill ${x.overdue ? 'Overdue' : 'Due'}">${x.overdue ? 'Overdue' : 'Due Today'}</span></td>
      <td>${x.lead.assignedTo}</td>
    </tr>`).join('') || `<tr><td colspan="6"><div class="empty-row">All clear — nothing in this bucket.</div></td></tr>`;

  return `
    <div class="page-head"><div><h1>Follow-ups</h1><p>Converted / Follow Up enquiries due today or overdue — from Follow_Up_Date.</p></div></div>
    <div class="counters cols-3">
      <div class="ccard bad"><div class="label">Overdue</div><div class="value">${overdue.length}</div></div>
      <div class="ccard warn"><div class="label">Due today</div><div class="value">${dueToday.length}</div></div>
      <div class="ccard good"><div class="label">Completed today</div><div class="value">${completedToday}</div></div>
    </div>
    <div class="subtabs">
      <button class="${AppState.fuSubtab === 'overdue' ? 'active' : ''}" onclick="AppState.fuSubtab='overdue';AppState.fuSelected=null;render();">Overdue <span class="count red">${overdue.length}</span></button>
      <button class="${AppState.fuSubtab === 'today' ? 'active' : ''}" onclick="AppState.fuSubtab='today';AppState.fuSelected=null;render();">Due today <span class="count">${dueToday.length}</span></button>
    </div>
    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:18px;align-items:flex-start;">
      <div class="table-wrap"><table><thead><tr><th>Guest</th><th>Status</th><th>Tour Zone</th><th>Due</th><th>Bucket</th><th>Owner</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${selectedItem ? renderFollowupCard(selectedItem) : `<div class="ov-card">Select a follow-up to view the call card.</div>`}
    </div>`;
}
function renderFollowupCard(item) {
  const e = item.lead;
  return `
    <div class="ov-card">
      <div class="ov-card-head"><div class="t">Follow-up — ${e.name}</div><span class="chip small">${e.tourZone || 'Zone TBD'}</span></div>
      <div class="dl-grid" style="margin-bottom:12px;">
        <div><div class="k">PAX</div><div class="v">${e.adults} Adult${e.children ? ` + ${e.children} Child` : ''}</div></div>
        <div><div class="k">Travel Date</div><div class="v">${e.travelDate ? fmtDate(new Date(e.travelDate)) : 'TBD'}</div></div>
        <div><div class="k">Budget</div><div class="v">${fmtBudget(e.budget)}</div></div>
        <div><div class="k">Prior Remarks</div><div class="v">${e.remarks || 'None yet'}</div></div>
      </div>
      <div class="field"><label>Follow-up Notes</label><textarea id="fuNotes" rows="2" placeholder="What happened on this call?"></textarea></div>
      <div class="field"><label>Next Follow-up Date <span class="opt">(if rescheduling)</span></label><input type="date" id="fuNextDate"></div>
      <div class="outcome-row five">
        <button class="outbtn pos" onclick="logFollowupOutcome('${e.id}','Booked')">Booked / Won</button>
        <button class="outbtn neu" onclick="logFollowupOutcome('${e.id}','StillDeciding')">Still Deciding</button>
        <button class="outbtn neu" onclick="logFollowupOutcome('${e.id}','NoAnswer')">No Answer</button>
        <button class="outbtn neu" onclick="logFollowupOutcome('${e.id}','Reschedule')">Reschedule</button>
        <button class="outbtn neg" onclick="logFollowupOutcome('${e.id}','Lost')">Lost / Cold</button>
      </div>
      <div class="hint">Booked/Lost are tagged via a Remarks prefix ([BOOKED]/[LOST]) since the sheet's Status dropdown has no such option yet — see the chat for how to add real Booked/Lost values if you'd like.</div>
    </div>`;
}
async function logFollowupOutcome(id, outcome) {
  const e = LEADS.find((l) => l.id === id); if (!e) return;
  const notes = document.getElementById('fuNotes') ? document.getElementById('fuNotes').value : '';
  const nextDateVal = document.getElementById('fuNextDate') ? document.getElementById('fuNextDate').value : '';
  const patch = { lastAttempt: new Date(), lastActivity: 'just now', attempts: e.attempts + 1 };

  if (outcome === 'Booked') {
    patch.followUpDate = null;
    patch.remarks = `[BOOKED] ${notes || 'Confirmed booking'}`.trim();
    // status stays Converted/Follow Up — isWonEnquiry() detects it via the Remarks tag
  } else if (outcome === 'Lost') {
    patch.status = 'Not Interested';
    patch.followUpDate = null;
    patch.remarks = `[LOST] ${notes || 'Went cold after follow-up'}`.trim();
  } else {
    patch.status = 'Follow Up';
    patch.followUpDate = nextDateVal ? new Date(nextDateVal) : addDays(now(), outcome === 'NoAnswer' ? 1 : 3);
    if (notes) patch.remarks = notes;
  }

  Object.assign(e, patch);
  AppState.fuSelected = null;
  updateNavBadges(LEADS);
  render();
  const label = {
    Booked: `🎉 ${e.name} — booking confirmed!`,
    Lost: 'Enquiry closed as Lost/Cold.',
    StillDeciding: 'Logged — still deciding. Next follow-up scheduled.',
    NoAnswer: 'Logged No Answer. Next follow-up scheduled.',
    Reschedule: 'Follow-up rescheduled.',
  }[outcome];
  await persist(id, patch, label);
}

/* ---------------------------- INIT ---------------------------- */
boot();
