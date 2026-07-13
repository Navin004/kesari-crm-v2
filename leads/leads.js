/* =====================================================================================
   LEADS PAGE LOGIC  (leads/leads.js)
   Everything specific to the Leads screen: the dashboard, "All Assigned Leads",
   and the Incoming Call overlay (qualifying capture + Convert to Enquiry + outcomes).
===================================================================================== */

let LEADS = [];
let LOADING = true;
let LOAD_ERROR = null;

const AppState = {
  leadsSubtab: 'active',
  leadsAllView: false,
  leadsAllFilter: 'active',
  leadsSourceFilter: 'All Sources',
  leadsSearch: '',
  overlayLeadId: null,
};

/* ---------------------------- BOOT ---------------------------- */
async function boot() {
  LOADING = true; LOAD_ERROR = null;
  renderNav('leads');
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
  root.innerHTML = AppState.leadsAllView ? renderAllLeadsView() : renderLeadsDashboard();
  root.insertAdjacentHTML('beforeend', footerNote(LEADS.length));
}

/* =====================================================================================
   LEADS DASHBOARD
===================================================================================== */
function leadBuckets() {
  const open = LEADS.filter(isOpenLead);
  const hot = open.filter((l) => statusIn(l.status, ['Hot Lead']) || l.attempts >= 2);
  const overdue = open.filter((l) => isOverdue(l.followUpDate));
  const scheduledTomorrow = open.filter((l) => isTomorrow(l.followUpDate));
  const converted = LEADS.filter((l) => statusIn(l.status, ENQUIRY_STATUSES));
  return { open, hot, overdue, scheduledTomorrow, converted };
}
function renderLeadsDashboard() {
  const b = leadBuckets();
  const calledToday = LEADS.filter((l) => l.lastAttempt && isToday(l.lastAttempt)).length;
  const pending = b.open.length;
  const convertedCount = b.converted.length;
  const rate = LEADS.length ? ((convertedCount / LEADS.length) * 100).toFixed(1) : '0.0';

  let items = { hot: b.hot, active: b.open, overdue: b.overdue, scheduled: b.scheduledTomorrow, converted: b.converted }[AppState.leadsSubtab] || b.open;
  let filtered = items.filter((l) => AppState.leadsSourceFilter === 'All Sources' || l.source === AppState.leadsSourceFilter);
  if (AppState.leadsSearch.trim()) {
    const q = AppState.leadsSearch.trim().toLowerCase();
    filtered = filtered.filter((l) => l.name.toLowerCase().includes(q) || (l.hub || '').toLowerCase().includes(q));
  }

  const rows = filtered.map((l) => `
    <tr onclick="openLeadOverlay('${l.id}')">
      <td><div class="cust"><div class="cust-avatar">${initials(l.name)}</div><div>${l.name}<div class="cust-sub">${l.mobileDisplay}</div></div></div></td>
      <td><span class="tag ${cssSafe(l.source)}">${l.source}</span></td>
      <td>${l.hub || '—'}</td>
      <td>${l.attempts}/3 <span class="attempt-dots">${dotsFor(l.attempts)}</span></td>
      <td>${fmtDate(l.dateReceived)}<div class="cust-sub">${fmtTimeAgo(l.dateReceived)}</div></td>
      <td><button class="callbtn" onclick="event.stopPropagation();openLeadOverlay('${l.id}')" title="Call">📞</button></td>
    </tr>`).join('') || `<tr><td colspan="6"><div class="empty-row">No leads in this view.</div></td></tr>`;

  const sources = ['All Sources', ...SOURCE_OPTIONS.filter((s) => LEADS.some((l) => l.source === s))];

  return `
    <div class="page-head">
      <div><h1>Leads Dashboard</h1><p>Live from Google Sheets — manage and track your assigned leads.</p></div>
      <div class="date-badge">📅 Today, ${fmtDate(now())}</div>
    </div>
    <div class="counters">
      <div class="ccard"><div class="label">Total Records</div><div class="value">${LEADS.length}</div></div>
      <div class="ccard"><div class="label">Called today</div><div class="value">${calledToday}</div></div>
      <div class="ccard"><div class="label">Pending</div><div class="value">${pending}</div></div>
      <div class="ccard"><div class="label">Converted</div><div class="value">${convertedCount}</div></div>
      <div class="ccard hero"><div class="label">Conversion rate</div><div class="value">${rate}%</div></div>
    </div>
    <div class="subtabs">
      <button class="${AppState.leadsSubtab === 'hot' ? 'active' : ''}" onclick="setLeadsSubtab('hot')">Hot <span class="count">${b.hot.length}</span></button>
      <button class="${AppState.leadsSubtab === 'active' ? 'active' : ''}" onclick="setLeadsSubtab('active')">Active <span class="count">${b.open.length}</span></button>
      <button class="${AppState.leadsSubtab === 'overdue' ? 'active' : ''}" onclick="setLeadsSubtab('overdue')">Overdue <span class="count red">${b.overdue.length}</span></button>
      <button class="${AppState.leadsSubtab === 'scheduled' ? 'active' : ''}" onclick="setLeadsSubtab('scheduled')">Scheduled for Tomorrow <span class="count">${b.scheduledTomorrow.length}</span></button>
      <button class="${AppState.leadsSubtab === 'converted' ? 'active' : ''}" onclick="setLeadsSubtab('converted')">Converted <span class="count">${b.converted.length}</span></button>
      <div class="subtabs-tail"><button class="link-btn" style="float:right" onclick="openAllLeadsView()">View All →</button></div>
    </div>
    <div class="filters-row">
      ${sources.map((s) => `<button class="chip ${AppState.leadsSourceFilter === s ? 'active' : ''}" onclick="setSourceFilter('${s}')">${s}</button>`).join('')}
      <div class="search-box">🔍 <input placeholder="Search leads..." value="${AppState.leadsSearch}" oninput="AppState.leadsSearch=this.value; render();"></div>
    </div>
    <div class="table-wrap">
      <table><thead><tr><th>Customer Name</th><th>Source</th><th>Hub</th><th>Attempt</th><th>Received</th><th>Action</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}
function dotsFor(n) { let out = ''; for (let i = 1; i <= 3; i++) out += `<span class="${i <= n ? 'done' : ''}"></span>`; return out; }
function setLeadsSubtab(t) { AppState.leadsSubtab = t; render(); }
function setSourceFilter(s) { AppState.leadsSourceFilter = s; render(); }
function openAllLeadsView() { AppState.leadsAllView = true; render(); }

/* =====================================================================================
   ALL ASSIGNED LEADS
===================================================================================== */
function renderAllLeadsView() {
  const total = LEADS.length;
  const totalHandled = LEADS.filter((l) => !isOpenLead(l) || statusIn(l.status, ['Scheduled'])).length;
  const converted = LEADS.filter((l) => statusIn(l.status, ENQUIRY_STATUSES)).length;
  const notInterested = LEADS.filter((l) => statusIn(l.status, ['Not Interested'])).length;
  const invalid = LEADS.filter((l) => statusIn(l.status, ['Invalid'])).length;
  const unreachable = LEADS.filter((l) => statusIn(l.status, ['Unreachable'])).length;
  const rate = total ? ((converted / total) * 100).toFixed(1) : '0.0';

  let list = LEADS.filter((l) => {
    if (AppState.leadsAllFilter === 'all') return true;
    if (AppState.leadsAllFilter === 'active') return isOpenLead(l);
    if (AppState.leadsAllFilter === 'converted') return statusIn(l.status, ENQUIRY_STATUSES);
    if (AppState.leadsAllFilter === 'not_interested') return statusIn(l.status, ['Not Interested']);
    if (AppState.leadsAllFilter === 'invalid') return statusIn(l.status, ['Invalid']);
    if (AppState.leadsAllFilter === 'unreachable') return statusIn(l.status, ['Unreachable']);
    return true;
  });

  const rows = list.map((l) => `
    <tr>
      <td onclick="openLeadOverlay('${l.id}')" style="cursor:pointer;"><div style="font-weight:700;">${l.name}</div><div class="cust-sub">📞 ${l.mobileDisplay}</div></td>
      <td onclick="openLeadOverlay('${l.id}')" style="cursor:pointer;">${fmtDate(l.dateReceived)}</td>
      <td onclick="openLeadOverlay('${l.id}')" style="cursor:pointer;"><span class="tag ${cssSafe(l.source)}">${l.source}</span></td>
      <td onclick="openLeadOverlay('${l.id}')" style="cursor:pointer;">${l.followUpDate ? fmtDate(l.followUpDate) : '—'}<div class="cust-sub">Attempt ${l.attempts}/3</div></td>
      <td onclick="openLeadOverlay('${l.id}')" style="cursor:pointer;"><span class="status-pill ${cssSafe(l.status)}">${statusIcon(l.status)} ${l.status}</span></td>
      <td onclick="openLeadOverlay('${l.id}')" style="cursor:pointer;">${l.assignedTo}</td>
      <td>
        <button class="pill-btn" onclick="event.stopPropagation();openLeadOverlay('${l.id}')" title="Update">✎ Update</button>
        <button class="pill-btn" style="color:var(--red);border-color:var(--red);" onclick="event.stopPropagation();deleteLeadRow('${l.id}')" title="Delete">🗑</button>
      </td>
    </tr>`).join('') || `<tr><td colspan="7"><div class="empty-row">No leads match this filter.</div></td></tr>`;

  return `
    <button class="link-btn" style="margin-bottom:14px;" onclick="AppState.leadsAllView=false; render();">← Back to Leads Dashboard</button>
    <div class="page-head">
      <div><h1>All Assigned Leads</h1></div>
      <div style="display:flex;gap:10px;align-items:center;">
        <div class="date-badge">Total: ${total.toLocaleString()}</div>
        <button class="export-btn" onclick="toast('Exporting current filtered list as CSV…','info')">Export List</button>
      </div>
    </div>
    <div class="counters cols-4" style="margin-bottom:14px;">
      <div class="ccard"><div class="label">Total Assigned</div><div class="value">${total}</div></div>
      <div class="ccard warn"><div class="label">Total Handled</div><div class="value">${totalHandled}</div></div>
      <div class="ccard good"><div class="label">Converted</div><div class="value">${converted}</div></div>
      <div class="ccard warn"><div class="label">Conversion Rate</div><div class="value">${rate}%</div></div>
    </div>
    <div class="counters cols-3">
      <div class="ccard"><div class="label">Not Interested</div><div class="value">${notInterested}</div></div>
      <div class="ccard"><div class="label">Invalid</div><div class="value">${invalid}</div></div>
      <div class="ccard"><div class="label">Unreachable</div><div class="value">${unreachable}</div></div>
    </div>
    <div class="filters-row" style="margin-top:20px;">
      ${[['active', 'Active'], ['converted', 'Converted'], ['not_interested', 'Not Interested'], ['invalid', 'Invalid'], ['unreachable', 'Unreachable'], ['all', 'All']].map(([k, l]) =>
        `<button class="chip ${AppState.leadsAllFilter === k ? 'active' : ''}" onclick="AppState.leadsAllFilter='${k}';render();">${l}</button>`).join('')}
    </div>
    <div class="table-wrap">
      <table><thead><tr><th>Name &amp; Contact</th><th>Date Received</th><th>Source</th><th>Follow-up / Attempt</th><th>Current Status</th><th>Assigned To</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}

/* =====================================================================================
   INCOMING CALL OVERLAY / LEAD DETAIL
===================================================================================== */
let callTimerHandle = null;
function openLeadOverlay(leadId) {
  const lead = LEADS.find((l) => l.id === leadId);
  if (!lead) return;
  AppState.overlayLeadId = leadId;
  document.getElementById('overlayBackdrop').classList.add('open');
  renderOverlay();
}
function closeOverlay() {
  const lead = currentLead();
  if (lead) lead.callActive = false;
  clearInterval(callTimerHandle);
  document.getElementById('overlayBackdrop').classList.remove('open');
  AppState.overlayLeadId = null;
  render();
}
function currentLead() { return LEADS.find((l) => l.id === AppState.overlayLeadId); }

function toggleCall() {
  const lead = currentLead(); if (!lead) return;
  lead.callActive = !lead.callActive;
  if (lead.callActive) {
    clearInterval(callTimerHandle);
    callTimerHandle = setInterval(() => { lead.callDuration += 1; updateTimerChipOnly(lead); }, 1000);
    toast('Call connected — timer started.', 'info');
  } else { clearInterval(callTimerHandle); toast('Call ended.'); }
  renderOverlay();
}
function updateTimerChipOnly(lead) {
  const chip = document.getElementById('timerChip'); if (!chip) return;
  const convBtn = document.getElementById('convertBtn');
  const mm = String(Math.floor(lead.callDuration / 60)); const ss = String(lead.callDuration % 60).padStart(2, '0');
  const ok = lead.callDuration >= 20;
  chip.className = 'timer-chip' + (ok ? ' ok' : '');
  chip.innerText = ok ? `${mm}:${ss} ✓ min. reached` : `${mm}:${ss} — minimum 20s required`;
  if (convBtn) convBtn.disabled = !canPromote(lead);
}
function canPromote(lead) {
  const q = lead.qualifying;
  return lead.callDuration >= 20 && !!q.pincode && String(q.pincode).length >= 5 && !!q.tourZone && q.adults >= 1 && !!q.travelDate;
}
function setQualField(field, val) { const lead = currentLead(); if (!lead) return; lead.qualifying[field] = val; renderOverlay(); }
function stepPax(kind, delta) { const lead = currentLead(); if (!lead) return; lead.qualifying[kind] = Math.max(0, lead.qualifying[kind] + delta); renderOverlay(); }

async function logLeadAttemptOutcome(outcome) {
  const lead = currentLead(); if (!lead) return;
  const patch = { lastAttempt: new Date(), lastActivity: 'just now' };
  if (outcome === 'Not Interested') {
    patch.status = 'Not Interested';
  } else if (outcome === 'Wrong Number') {
    patch.status = 'Invalid';
  } else if (outcome === 'No Answer') {
    const nextAttempts = lead.attempts + 1;
    patch.attempts = nextAttempts;
    if (nextAttempts >= 3) {
      patch.status = 'Unreachable';
      patch.followUpDate = null;
    } else {
      // Keep "Hot Lead" if it was already flagged that way; otherwise "Scheduled" (next attempt due).
      patch.status = statusIn(lead.status, ['Hot Lead']) ? 'Hot Lead' : 'Scheduled';
      patch.followUpDate = addDays(now(), nextAttempts === 2 ? 1 : 3);
    }
  }
  Object.assign(lead, patch);
  closeOverlay();
  updateNavBadges(LEADS);
  await persist(lead.id, patch, outcome === 'No Answer'
    ? (lead.status === 'Unreachable' ? 'Third attempt unreachable — auto-closed.' : `Logged No Answer. Attempt ${lead.attempts}/3 scheduled.`)
    : `Lead marked "${outcome}".`);
}

async function promoteLead() {
  const lead = currentLead(); if (!lead || !canPromote(lead)) return;
  const q = lead.qualifying;
  const patch = {
    status: 'Converted', pincode: q.pincode, tourZone: q.tourZone, tourSector: q.tourSector,
    destination: q.destination, adults: q.adults, children: q.children, travelDate: q.travelDate,
    budget: q.budget, followUpDate: addHours(now(), 24), lastAttempt: new Date(), lastActivity: 'just now',
    attempts: lead.attempts + 1,
  };
  Object.assign(lead, patch);
  lead.followUpDate = patch.followUpDate;
  closeOverlay();
  updateNavBadges(LEADS);
  await persist(lead.id, patch, `✓ Promoted to Enquiry — follow-up scheduled for tomorrow.`);
}

async function saveManualEdits() {
  const lead = currentLead(); if (!lead) return;
  const patch = {
    assignedTo: document.getElementById('editAssignedTo').value,
    priority: document.getElementById('editPriority').value,
    remarks: document.getElementById('editRemarks').value,
  };
  Object.assign(lead, patch);
  renderOverlay();
  await persist(lead.id, patch, '💾 Record updated.');
}

function renderOverlay() {
  const lead = currentLead();
  if (!lead) { document.getElementById('overlayPanel').innerHTML = ''; return; }
  const q = lead.qualifying;
  const mm = String(Math.floor(lead.callDuration / 60)); const ss = String(lead.callDuration % 60).padStart(2, '0');
  const ok = lead.callDuration >= 20;
  const promotable = canPromote(lead);

  document.getElementById('overlayPanel').innerHTML = `
    <div class="ov-head">
      <div class="ov-avatar">${initials(lead.name)}</div>
      <div class="ov-title">
        <div class="name">${lead.name}</div>
        <div class="tags"><span class="tag ${cssSafe(lead.source)}">${lead.source}</span><span class="chip small">${lead.status}</span><span class="chip small">Priority: ${lead.priority}</span></div>
      </div>
      <span class="timer-chip ${ok ? 'ok' : ''}" id="timerChip">${mm}:${ss} ${ok ? '✓ min. reached' : '— minimum 20s required'}</span>
      <button class="ov-callbtn ${lead.callActive ? 'ending' : ''}" onclick="toggleCall()">${lead.callActive ? '■ End Call' : '📞 Start Call'}</button>
      <button class="ov-convert" id="convertBtn" ${promotable ? '' : 'disabled'} onclick="promoteLead()">Convert to Enquiry</button>
      <button class="ov-close" onclick="closeOverlay()">✕</button>
    </div>
    <div class="ov-body">
      <div class="ov-col">
        <div class="ov-card">
          <div class="ov-card-head"><div class="t">💬 Original Inquiry</div><span class="chip small">${lead.source} · ${lead.campaign || 'No campaign'}</span></div>
          <div class="quote-box">${lead.originalInquiry || 'No inquiry text captured.'}</div>
        </div>
        <div class="ov-card">
          <div class="ov-card-head"><div class="t">ℹ️ Lead Information</div><span class="chip small">${lead.id}</span></div>
          <div class="dl-grid">
            <div><div class="k">Mobile</div><div class="v">${lead.mobileDisplay}</div></div>
            <div><div class="k">Email</div><div class="v">${lead.email || 'Not provided'}</div></div>
            <div><div class="k">Hub</div><div class="v">${lead.hub || '—'}</div></div>
            <div><div class="k">Destination</div><div class="v">${lead.destination || '—'}</div></div>
            <div><div class="k">Date Received</div><div class="v">${fmtDate(lead.dateReceived)}</div></div>
            <div><div class="k">Last Activity</div><div class="v" style="color:var(--accent-dark);">${lead.lastActivity || fmtTimeAgo(lead.lastAttempt)}</div></div>
            <div><div class="k">Lead Owner</div><div class="v">${lead.owner || '—'}</div></div>
            <div><div class="k">Created By</div><div class="v">${lead.createdBy || '—'}</div></div>
          </div>
        </div>
        <div class="ov-card">
          <div class="ov-card-head"><div class="t">✎ Manage Record</div></div>
          <div class="field"><label>Assigned To</label><input id="editAssignedTo" value="${lead.assignedTo}"></div>
          <div class="field"><label>Priority</label>
            <select id="editPriority">${['Low', 'Medium', 'High'].map((p) => `<option ${lead.priority === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Remarks</label><textarea id="editRemarks" rows="2">${lead.remarks || ''}</textarea></div>
          <button class="new-enquiry-btn" style="width:100%;justify-content:center;" onclick="saveManualEdits()">💾 Update Record</button>
        </div>
      </div>
      <div class="ov-col">
        <div class="ov-card accent">
          <div class="ov-card-head"><div class="t">📋 Qualifying Capture</div><span class="reqbadge">Required to convert</span></div>
          <div class="field ${!q.pincode ? 'missing' : ''}"><label>Pin Code *</label><input maxlength="6" placeholder="6-digit PIN" value="${q.pincode}" oninput="setQualField('pincode', this.value.replace(/[^0-9]/g,''))"></div>
          <div class="field ${!q.tourZone ? 'missing' : ''}"><label>Tour Zone *</label>
            <input list="zoneOptions" value="${q.tourZone}" placeholder="e.g. International" oninput="setQualField('tourZone', this.value)">
            <datalist id="zoneOptions">${TOUR_ZONE_OPTIONS.map((z) => `<option value="${z}">`).join('')}</datalist>
          </div>
          <div class="field"><label>Tour Sector</label><input placeholder="e.g. Vietnam, Dubai" value="${q.tourSector}" oninput="setQualField('tourSector', this.value)"></div>
          <div class="field"><label>Destination</label><input placeholder="e.g. Vietnam" value="${q.destination}" oninput="setQualField('destination', this.value)"></div>
          ${!promotable ? `<div class="rule-note">⚠ Convert requires a ≥20s logged call <b>and</b> pin code, tour zone, travel date &amp; adults captured.</div>` : `<div class="rule-note" style="background:var(--green-wash);color:var(--green);border-color:#B9E4C8;">✓ Minimum data set captured — ready to promote.</div>`}
        </div>
        <div class="ov-card">
          <div class="ov-card-head"><div class="t">➕ Add Information</div></div>
          <div class="field"><label>PAX</label>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div class="counter-field"><div class="lbl">Adults</div><div class="stepper"><button onclick="stepPax('adults',-1)">−</button><span>${q.adults}</span><button onclick="stepPax('adults',1)">+</button></div></div>
              <div class="counter-field"><div class="lbl">Children</div><div class="stepper"><button onclick="stepPax('children',-1)">−</button><span>${q.children}</span><button onclick="stepPax('children',1)">+</button></div></div>
            </div>
          </div>
          <div class="field ${!q.travelDate ? 'missing' : ''}"><label>Travel Date *</label><input type="date" value="${q.travelDate}" onchange="setQualField('travelDate', this.value)"></div>
          <div class="field"><label>Budget (INR)</label><input placeholder="₹ Enter budget" value="${q.budget}" oninput="setQualField('budget', this.value)"></div>
        </div>
        <div class="ov-card">
          <div class="ov-card-head"><div class="t">📞 Attempt Outcome</div><span class="chip small">Attempt ${lead.attempts}/3</span></div>
          <div class="outcome-row">
            <button class="outbtn neu" onclick="logLeadAttemptOutcome('No Answer')">No Answer</button>
            <button class="outbtn neg" onclick="logLeadAttemptOutcome('Wrong Number')">Wrong Number</button>
            <button class="outbtn neg" onclick="logLeadAttemptOutcome('Not Interested')">Not Interested</button>
            <button class="outbtn pos" ${promotable ? '' : 'disabled style="opacity:.45;cursor:not-allowed;"'} onclick="promoteLead()">Convert →</button>
          </div>
          <div class="hint">Every click here writes straight back to the Google Sheet (Status, Attempts, Last_Attempt, Follow_Up_Date, Updated_At).</div>
        </div>
      </div>
    </div>`;
}

/* ---------------------------- INIT ---------------------------- */
document.getElementById('overlayBackdrop').addEventListener('click', (e) => { if (e.target.id === 'overlayBackdrop') closeOverlay(); });
boot();
