/* =====================================================================================
   ENQUIRIES PAGE LOGIC  (enquiries/enquiries.js)
   Shows rows where Status = Converted or Follow Up (the real sheet has no separate
   Enquiries tab, so we filter the same Leads sheet). Since the sheet's Status dropdown
   has no "Booked"/"Lost" option, Won/Lost are tracked via a "[BOOKED]"/"[LOST]" prefix
   on Remarks — see shared/shared.js isWonEnquiry() / isLostEnquiry().
===================================================================================== */

let LEADS = [];
let LOADING = true;
let LOAD_ERROR = null;

const AppState = { enqSubtab: 'active', enqSelected: null };

/* ---------------------------- BOOT ---------------------------- */
async function boot() {
  LOADING = true; LOAD_ERROR = null;
  renderNav('enquiries');
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
  // Support ../leads/index.html or nav's "+ New Enquiry" linking here with ?new=1
  if (new URLSearchParams(location.search).get('new') === '1') openNewEnquiryForm();
}

function render() {
  const root = document.getElementById('pageRoot');
  if (LOADING) { root.innerHTML = renderLoading(); return; }
  if (LOAD_ERROR && LEADS.length === 0) { root.innerHTML = renderErrorState(LOAD_ERROR); return; }
  root.innerHTML = renderEnquiriesTab();
  root.insertAdjacentHTML('beforeend', footerNote(LEADS.length));
}

/* =====================================================================================
   ENQUIRIES TAB
===================================================================================== */
function renderEnquiriesTab() {
  const pipeline = LEADS.filter((l) => statusIn(l.status, ENQUIRY_STATUSES));
  const won = pipeline.filter(isWonEnquiry);
  const lost = LEADS.filter(isLostEnquiry);
  const active = pipeline.filter((l) => !isWonEnquiry(l));
  const map = { active, won, lost };
  const list = map[AppState.enqSubtab] || active;
  const selected = list.find((l) => l.id === AppState.enqSelected) || list[0];

  const rows = list.map((e) => `
    <tr onclick="AppState.enqSelected='${e.id}';render();" style="${selected && selected.id === e.id ? 'background:#FEFAF6;' : ''}">
      <td><div style="font-weight:700;">${e.name}</div><div class="cust-sub">${e.hub || ''}${e.pincode ? ' · ' + e.pincode : ''}</div></td>
      <td>${e.tourZone || '—'}${e.destination ? ' · ' + e.destination : ''}</td>
      <td>${e.adults + e.children} pax</td>
      <td>${e.travelDate ? fmtDate(new Date(e.travelDate)) : 'TBD'}</td>
      <td><span class="status-pill ${cssSafe(e.status)}">${e.status}</span></td>
      <td>${e.assignedTo}</td>
    </tr>`).join('') || `<tr><td colspan="6"><div class="empty-row">Nothing here yet.</div></td></tr>`;

  return `
    <div class="page-head"><div><h1>Enquiries</h1><p>Converted / Follow Up leads — the real pipeline, live from the sheet.</p></div></div>
    <div class="counters cols-3">
      <div class="ccard"><div class="label">Active</div><div class="value">${active.length}</div></div>
      <div class="ccard good"><div class="label">Won</div><div class="value">${won.length}</div></div>
      <div class="ccard bad"><div class="label">Lost</div><div class="value">${lost.length}</div></div>
    </div>
    <div class="subtabs">
      <button class="${AppState.enqSubtab === 'active' ? 'active' : ''}" onclick="AppState.enqSubtab='active';AppState.enqSelected=null;render();">Active <span class="count">${active.length}</span></button>
      <button class="${AppState.enqSubtab === 'won' ? 'active' : ''}" onclick="AppState.enqSubtab='won';AppState.enqSelected=null;render();">Won <span class="count">${won.length}</span></button>
      <button class="${AppState.enqSubtab === 'lost' ? 'active' : ''}" onclick="AppState.enqSubtab='lost';AppState.enqSelected=null;render();">Lost <span class="count">${lost.length}</span></button>
    </div>
    <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:18px;align-items:flex-start;">
      <div class="table-wrap"><table><thead><tr><th>Guest</th><th>Zone / Destination</th><th>PAX</th><th>Travel Date</th><th>Status</th><th>Owner</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${selected ? renderEnquiryCard(selected) : `<div class="ov-card">Select an enquiry to see full details.</div>`}
    </div>`;
}
function renderEnquiryCard(e) {
  const won = isWonEnquiry(e); const lost = isLostEnquiry(e);
  return `
    <div class="ov-card">
      <div class="ov-card-head"><div class="t">Enquiry — ${e.id}</div><span class="chip small">${e.source}</span></div>
      <div class="dl-grid" style="margin-bottom:14px;">
        <div><div class="k">Guest</div><div class="v">${e.name}</div></div>
        <div><div class="k">Phone</div><div class="v">${e.mobileDisplay}</div></div>
        <div><div class="k">PAX</div><div class="v">${e.adults} Adult${e.children ? ` + ${e.children} Child` : ''}</div></div>
        <div><div class="k">Budget</div><div class="v">${fmtBudget(e.budget)}</div></div>
        <div><div class="k">Tour Zone</div><div class="v">${e.tourZone || '—'}</div></div>
        <div><div class="k">Destination</div><div class="v">${e.destination || '—'}</div></div>
        <div><div class="k">Remarks</div><div class="v">${e.remarks || 'None'}</div></div>
        <div><div class="k">Updated</div><div class="v">${e.updatedAt ? fmtTimeAgo(e.updatedAt) : '—'}</div></div>
      </div>
      ${won ? `<div class="rule-note" style="background:var(--green-wash);color:var(--green);border-color:#B9E4C8;">🎉 Booked / Won</div>` : ''}
      ${lost ? `<div class="rule-note" style="background:var(--red-wash);color:var(--red);border-color:#F0B4A8;">Marked Lost / Cold</div>` : ''}
      <div class="field"><label>Edit Budget</label><input id="enqBudget" value="${e.budget}"></div>
      <div class="field"><label>Edit Remarks</label><textarea id="enqRemarks" rows="2">${e.remarks || ''}</textarea></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="new-enquiry-btn" onclick="updateEnquiry('${e.id}')">💾 Update</button>
        <button class="chip small" style="color:var(--red);border-color:var(--red);" onclick="deleteLeadRow('${e.id}')">🗑 Delete</button>
      </div>
    </div>`;
}
async function updateEnquiry(id) {
  const e = LEADS.find((l) => l.id === id); if (!e) return;
  const patch = { budget: document.getElementById('enqBudget').value, remarks: document.getElementById('enqRemarks').value };
  Object.assign(e, patch);
  render();
  await persist(id, patch, '💾 Enquiry updated.');
}

/* =====================================================================================
   NEW ENQUIRY  (direct — skips the Leads stage entirely, per the operating model)
===================================================================================== */
function openNewEnquiryForm() {
  document.getElementById('overlayBackdrop').classList.add('open');
  document.getElementById('overlayPanel').innerHTML = `
    <div class="ov-head"><div class="ov-title"><div class="name">New Direct Enquiry</div><div class="tags"><span class="chip small">Website / Walk-in / Inbound</span></div></div><button class="ov-close" onclick="closeOverlay()">✕</button></div>
    <div style="padding:22px 26px;">
      <div class="rule-note" style="margin-bottom:16px;">Direct enquiries skip the Leads stage — created straight in as Status = Converted, with a follow-up scheduled for tomorrow. Saved directly to your Google Sheet.</div>
      <div class="ov-card">
        <div class="field-row"><div class="field"><label>Guest Name *</label><input id="neName" placeholder="Full name"></div><div class="field"><label>Mobile *</label><input id="nePhone" placeholder="10-digit mobile"></div></div>
        <div class="field-row"><div class="field"><label>Hub</label><input id="neHub" placeholder="City"></div><div class="field"><label>Pin Code</label><input id="nePin" maxlength="6" placeholder="6-digit PIN"></div></div>
        <div class="field-row"><div class="field"><label>Tour Zone</label><input id="neZone" list="zoneOptions2" placeholder="e.g. International"><datalist id="zoneOptions2">${TOUR_ZONE_OPTIONS.map((z) => `<option value="${z}">`).join('')}</datalist></div><div class="field"><label>Travel Date</label><input type="date" id="neDate"></div></div>
        <div class="field-row"><div class="field"><label>Adults</label><input type="number" min="1" value="2" id="neAdults"></div><div class="field"><label>Children</label><input type="number" min="0" value="0" id="neChildren"></div></div>
        <div class="field"><label>Destination</label><input id="neDestination" placeholder="e.g. Vietnam"></div>
        <div class="field"><label>Budget</label><input id="neBudget" placeholder="Enter budget"></div>
        <button class="new-enquiry-btn" style="width:100%;justify-content:center;" onclick="createDirectEnquiry()">Create Enquiry</button>
      </div>
    </div>`;
}
function closeOverlay() { document.getElementById('overlayBackdrop').classList.remove('open'); }

async function createDirectEnquiry() {
  const name = document.getElementById('neName').value.trim();
  const mobile = document.getElementById('nePhone').value.trim();
  if (!name || !mobile) { toast('Name and mobile are required.'); return; }
  const fields = {
    name, mobile, source: 'Website', campaign: 'Direct', originalInquiry: '(created directly by agent)',
    destination: document.getElementById('neDestination').value.trim(),
    tourZone: document.getElementById('neZone').value.trim(),
    tourSector: '', hub: document.getElementById('neHub').value.trim(),
    assignedTo: 'Ravi K.', status: 'Converted', priority: 'Medium', attempts: 1,
    lastAttempt: new Date(), lastActivity: 'just now', followUpDate: addHours(new Date(), 24),
    dateReceived: new Date(), adults: +document.getElementById('neAdults').value || 1,
    children: +document.getElementById('neChildren').value || 0,
    budget: document.getElementById('neBudget').value, travelDate: document.getElementById('neDate').value,
    pincode: document.getElementById('nePin').value.replace(/[^0-9]/g, ''), remarks: '', owner: 'Ravi K.',
    createdBy: 'Agent', updatedAt: new Date(),
  };
  closeOverlay();
  try {
    const id = await createLeadRemote(fields);
    LEADS.unshift(rowToLead({ ...patchToRow(fields), Lead_ID: id }));
    AppState.enqSubtab = 'active';
    updateNavBadges(LEADS);
    toast('✓ Direct enquiry created and saved to Google Sheets.', 'success');
  } catch (err) {
    toast(`⚠ Could not save to Google Sheets: ${err.message}`);
  }
  render();
}

/* ---------------------------- INIT ---------------------------- */
document.getElementById('overlayBackdrop').addEventListener('click', (e) => { if (e.target.id === 'overlayBackdrop') closeOverlay(); });
boot();
