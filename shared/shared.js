/* =====================================================================================
   KESARI CRM — SHARED UTILITIES  (shared/shared.js)
   Loaded by every page, AFTER data-api.js and BEFORE the page's own <page>.js.
   Contains: date/format helpers, toast(), the real Status/Source vocabulary + lenient
   matching helpers, the nav component, and generic delete-record handling.
===================================================================================== */

/* ---------------------------- DATE / FORMAT HELPERS ---------------------------- */
const now = () => new Date();
const addHours = (d, h) => new Date(d.getTime() + h * 3600 * 1000);
const addDays = (d, n) => new Date(d.getTime() + n * 86400 * 1000);
const fmtDate = (d) => (d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtTimeAgo = (d) => {
  if (!d) return '—';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};
const isOverdue = (d) => !!d && d.getTime() < Date.now();
const isToday = (d) => !!d && new Date(d).toDateString() === new Date().toDateString();
const isTomorrow = (d) => !!d && new Date(d).toDateString() === addDays(new Date(new Date().setHours(0, 0, 0, 0)), 1).toDateString();
const initials = (name) => (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtBudget = (b) => (b ? (String(b).startsWith('₹') ? b : `₹${Number(b).toLocaleString('en-IN')}`) : '—');
const isMorning = () => new Date().getHours() < 13.5;

/* ---------------------------- TOAST ---------------------------- */
function toast(msg, kind = 'default') {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (kind === 'success' ? 'success' : kind === 'info' ? 'info' : '');
  el.innerHTML = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3600);
}

/* ---------------------------- REAL SHEET VOCABULARY ----------------------------
   From the Status column's dropdown (Data validation) on the live sheet — do not
   invent new values, always write one of these exact strings back.
     Not Interested | Scheduled | Active | Converted | Follow Up | Unreachable | Hot Lead | Invalid
   From the Lead_Source column's filter chips on the dashboard:
     Website | Facebook | Referral | Walk In | Instagram | WhatsApp | Google Ads | JustDial
------------------------------------------------------------------------------- */
const TOUR_ZONE_OPTIONS = ['Domestic', 'International', 'GCC', 'Europe', 'Southeast Asia', 'Cruise'];
const LEAD_OPEN_STATUSES = ['Active', 'Scheduled', 'Hot Lead'];      // pre-conversion, still being worked
const LEAD_TERMINAL = ['Not Interested', 'Invalid', 'Unreachable'];  // pre-conversion, closed
const ENQUIRY_STATUSES = ['Converted', 'Follow Up'];                 // post-conversion pipeline
const SOURCE_OPTIONS = ['Website', 'Facebook', 'Referral', 'Walk In', 'Instagram', 'WhatsApp', 'Google Ads', 'JustDial'];

function normStatus(s) { return String(s || '').trim().toLowerCase(); }
function statusIn(s, list) { return list.map((x) => x.toLowerCase()).includes(normStatus(s)); }
// "Open lead" = one of the known working statuses OR anything unrecognized (so a stray/blank
// value in the sheet still shows up somewhere instead of silently disappearing).
function isOpenLead(l) {
  if (statusIn(l.status, LEAD_OPEN_STATUSES)) return true;
  if (statusIn(l.status, [...LEAD_TERMINAL, ...ENQUIRY_STATUSES])) return false;
  return true; // unrecognized status text — treat as open rather than hide it
}
// Booked/Lost aren't real dropdown values (there's no such Status option), so we tag
// them via a Remarks prefix instead of inventing a Status the sheet's validation doesn't have.
function isWonEnquiry(l) { return statusIn(l.status, ENQUIRY_STATUSES) && /^\[BOOKED\]/i.test(l.remarks || ''); }
function isLostEnquiry(l) { return statusIn(l.status, ['Not Interested']) && /^\[LOST\]/i.test(l.remarks || ''); }
function statusIcon(s) {
  return { Active: '●', Scheduled: '◐', 'Hot Lead': '🔥', Converted: '✓', 'Follow Up': '↻', 'Not Interested': '✕', Invalid: '⚠', Unreachable: '○' }[s] || '●';
}
// CSS class names can't contain spaces — turn "Hot Lead" into "Hot-Lead", "Walk In" into "Walk-In", etc.
function cssSafe(s) { return String(s || '').trim().replace(/\s+/g, '-'); }

/* ---------------------------- NAV ---------------------------- */
function renderNav(active) {
  const root = document.getElementById('navRoot');
  if (!root) return;
  const enquiryHref = active === 'enquiries' ? 'javascript:void(0)' : '../enquiries/index.html?new=1';
  const enquiryClick = active === 'enquiries' ? ' onclick="openNewEnquiryForm()"' : '';
  root.innerHTML = `
    <div class="topnav">
      <div class="brand"><span class="brand-mark">K</span> Kesari CRM</div>
      <a class="new-enquiry-btn" href="${enquiryHref}"${enquiryClick}>＋ New Enquiry</a>
      <div class="pilltabs">
        <a class="${active === 'leads' ? 'active' : ''}" href="../leads/index.html">Leads <span class="badge" id="navLeadsBadge">–</span></a>
        <a class="${active === 'enquiries' ? 'active' : ''}" href="../enquiries/index.html">Enquiries</a>
        <a class="${active === 'followups' ? 'active' : ''}" href="../followups/index.html">Follow-ups <span class="badge" id="navFollowupsBadge"></span></a>
      </div>
      <div class="topnav-spacer"></div>
      <div class="focus-banner" id="focusBanner"></div>
      <button class="icon-btn" title="Refresh from Google Sheets" onclick="location.reload()">↻</button>
      <button class="icon-btn" title="Notifications"><span class="dot"></span>🔔</button>
      <button class="icon-btn" title="Settings">⚙️</button>
      <div class="avatar" title="Ravi K. — Call Centre Agent">RK</div>
    </div>`;
  const banner = document.getElementById('focusBanner');
  const morning = isMorning();
  banner.className = 'focus-banner' + (morning ? ' morning' : '');
  banner.innerHTML = morning ? '🌅 Morning Focus · Follow-ups' : '🔆 Afternoon Focus · Leads';
}
// Call after LEADS is loaded on any page to keep the nav badges in sync.
function updateNavBadges(leads) {
  const lb = document.getElementById('navLeadsBadge');
  const fb = document.getElementById('navFollowupsBadge');
  if (lb) lb.textContent = leads.filter(isOpenLead).length;
  if (fb) {
    const due = leads.filter((l) => statusIn(l.status, ENQUIRY_STATUSES) && l.followUpDate && (isOverdue(l.followUpDate) || isToday(l.followUpDate)));
    fb.textContent = due.length > 0 ? due.length : '';
  }
}

/* ---------------------------- GENERIC DELETE (used on Leads & Enquiries pages) ---------------------------- */
// Expects the calling page to define a global LEADS array and a global render() function.
async function deleteLeadRow(id) {
  if (!confirm('Delete this record permanently from the Google Sheet?')) return;
  const ok = await deleteLeadRemote(id).then(() => true).catch((err) => { toast(`⚠ Delete failed: ${err.message}`); return false; });
  if (ok) {
    LEADS = LEADS.filter((l) => l.id !== id);
    toast('Record deleted.', 'success');
    updateNavBadges(LEADS);
    if (typeof render === 'function') render();
  }
}

function renderLoading() {
  return `<div style="padding:80px 0;text-align:center;color:var(--ink-faint);">
    <div style="font-size:28px;margin-bottom:10px;">⏳</div>
    Loading from Google Sheets…
  </div>`;
}
function renderErrorState(loadError) {
  return `<div class="page-head"><div><h1>Couldn't load data</h1></div></div>
    <div class="ov-card" style="text-align:center;padding:40px;">
      <div style="font-size:30px;margin-bottom:10px;">⚠️</div>
      <div style="font-weight:800;margin-bottom:8px;">Couldn't load data from Google Sheets</div>
      <div class="hint" style="margin-bottom:16px;">${loadError}</div>
      <div class="hint">Check that <b>CONFIG.API_BASE_URL</b> in <code>shared/data-api.js</code> points to a deployed Apps Script Web App (ending in <code>/exec</code>).</div>
      <button class="new-enquiry-btn" style="margin-top:16px;" onclick="location.reload()">↻ Try Again</button>
    </div>`;
}
function footerNote(leadsCount) {
  return `<div class="footer-note">
    Live data from <a href="${CONFIG.SHEET_URL}" target="_blank" rel="noopener">Google Sheets</a> — "${CONFIG.SHEET_NAME}" tab · ${leadsCount} records loaded.
    <button class="link-btn" style="display:inline;font-size:11.5px;margin-left:8px;" onclick="location.reload()">↻ Refresh</button>
  </div>`;
}
