/* =====================================================================================
   ENQUIRIES PAGE LOGIC  (enquiries/enquiries.js)
   Shows rows where Status = Converted or Follow Up (the real sheet has no separate
   Enquiries tab, so we filter the same Leads sheet). Since the sheet's Status dropdown
   has no "Booked"/"Lost" option, Won/Lost are tracked via a "[BOOKED]"/"[LOST]" prefix
   on Remarks — see shared/shared.js isWonEnquiry() / isLostEnquiry().
===================================================================================== */


/* =====================================================================================
   ENQUIRIES PAGE
   Kesari CRM v2
===================================================================================== */

let LEADS = [];
let LOADING = true;
let LOAD_ERROR = null;

const AppState = {

    /* left menu */
    queue : "new",          // new | attention

    /* top chips */
    filter : "active",      // active won lost

    /* search */
    search : "",

    /* selected enquiry */
    selected : null,

    /* current record */
    enquiry : null

};


/* ==========================================================
BOOT
========================================================== */

async function boot(){

    LOADING = true;
    LOAD_ERROR = null;

    renderNav("enquiries");
    render();

    try{

        LEADS = await fetchAllLeads();

        toast(
            `Loaded ${LEADS.length} enquiries.`,
            "success"
        );

    }
    catch(err){

        LOAD_ERROR = err.message;

        LEADS = [];

    }

    LOADING = false;

    updateNavBadges(LEADS);

    render();

}


/* ==========================================================
RENDER
========================================================== */

function render(){

    const root = document.getElementById("pageRoot");

    if(LOADING){

        root.innerHTML = renderLoading();
        return;

    }

    if(LOAD_ERROR){

        root.innerHTML = renderErrorState(LOAD_ERROR);
        return;

    }

    root.innerHTML = renderEnquiries();

    root.insertAdjacentHTML(
        "beforeend",
        footerNote(LEADS.length)
    );

}

/* ==========================================================
CUSTOMER HEADER
========================================================== */

/* ==========================================================
   CUSTOMER HEADER
========================================================== */

// function renderCustomerHeader(e) {

//     const priority =
//         (e.priority || "Medium").toLowerCase();

//     return `

// <div class="customer-header">

//     <div class="customer-left">

//         <div class="customer-avatar">

//             ${initials(e.name)}

//         </div>

//         <div class="customer-details">

//             <div class="customer-title">

//                 <h2>${e.name}</h2>

//                 <span class="priority-badge ${priority}">
//                     ${e.priority || "Medium"}
//                 </span>

//                 <span class="status-pill ${cssSafe(e.status)}">
//                     ${e.status}
//                 </span>

//             </div>

//             <div class="customer-meta">

//                 <span>📞 ${e.mobileDisplay || e.mobile}</span>

//                 <span>📍 ${e.hub || "-"}</span>

//                 <span>👤 ${e.assignedTo || "-"}</span>

//             </div>

//         </div>

//     </div>

//     <div class="customer-actions">

//         <button class="icon-btn">

//             📞
//             <span>Call</span>

//         </button>

//         <button class="icon-btn">

//             💬
//             <span>WhatsApp</span>

//         </button>

//         <button class="icon-btn">

//             ✉️
//             <span>Email</span>

//         </button>

//     </div>

// </div>

// ${renderProgressTracker(e)}

// `;

// }

function renderCustomerHeader(e){

    return `

<div class="customer-header">

    <div class="customer-left">

        <div class="customer-avatar">

            ${initials(e.name)}

        </div>

        <div class="customer-details">

            <h2>

                ${e.name}

            </h2>

            <div class="customer-meta">

                <span>📞 ${e.mobileDisplay || e.mobile}</span>

                <span>👤 ${e.assignedTo || "-"}</span>

                <span>📍 ${e.hub || "-"}</span>

            </div>

        </div>

    </div>

    <div class="customer-right">

        <div class="customer-badges">

            <span class="priority-badge ${cssSafe((e.priority || "medium").toLowerCase())}">
                ${e.priority || "Medium"}
            </span>

            <span class="status-pill ${cssSafe(e.status)}">
                ${e.status}
            </span>

        </div>

        <div class="quick-actions">

            <button title="Call">📞</button>

            <button title="WhatsApp">💬</button>

            <button title="Email">✉</button>

        </div>

    </div>

</div>

`;

}

/* ==========================================================
   PROGRESS TRACKER
========================================================== */

function renderProgressTracker(e) {

    const steps = [

        {
            title: "Lead",
            done: true
        },

        {
            title: "Enquiry",
            done: true
        },

        {
            title: "Quotation",
            done:
                e.status === "Quotation Shared" ||
                isWonEnquiry(e)
        },

        {
            title: "Booking",
            done:
                isWonEnquiry(e)
        }

    ];

    return `

<div class="progress-wrap">

    ${steps.map(step => `

        <div class="progress-step ${step.done ? "done" : ""}">

            <div class="step-icon">

                ${step.done ? "✓" : "○"}

            </div>

            <div class="step-label">

                ${step.title}

            </div>

        </div>

    `).join("")}

</div>

`;

}

/* ==========================================================
PRIORITY CARD
========================================================== */

function renderPriorityCard(e) {

    const priority = e.priority || "Medium";

    return `

<div class="crm-card">

    <div class="card-title">

        Priority

    </div>

    <div class="priority-row">

        <span class="priority-badge ${priority.toLowerCase()}">

            ${priority}

        </span>

    </div>

</div>

`;

}
/* ==========================================================
PROGRESS CARD
========================================================== */

function renderProgressCard(e){

    let step = 2;

    if(isWonEnquiry(e))
        step = 4;

    return `

<div class="crm-card">

    <div class="card-title">

        Booking Progress

    </div>

    <div class="progress-wrap">

        <div class="progress-step ${step>=1?"done":""}">

            Lead

        </div>

        <div class="progress-step ${step>=2?"done":""}">

            Enquiry

        </div>

        <div class="progress-step ${step>=3?"done":""}">

            Follow Up

        </div>

        <div class="progress-step ${step>=4?"done":""}">

            Booked

        </div>

    </div>

</div>

`;

}
/* ==========================================================
HOTEL
========================================================== */

function renderHotelCard(e){

return `

<div class="crm-card">

    <div class="card-title">

        Hotel Preferences

    </div>

    <div class="detail-grid">

        <div>

            <label>Hotel</label>

            <select>

                <option>3 Star</option>
                <option>4 Star</option>
                <option>5 Star</option>

            </select>

        </div>

        <div>

            <label>Meals</label>

            <select>

                <option>Breakfast</option>
                <option>Breakfast + Dinner</option>
                <option>All Meals</option>

            </select>

        </div>

    </div>

    <div class="field">

        <label>Special Requests</label>

        <textarea rows="3"></textarea>

    </div>

</div>

`;

}
/* ==========================================================
TIMELINE
========================================================== */

function renderTimelineCard(e){

return `

<div class="crm-card">

    <div class="card-title">

        Timeline

    </div>

    <div class="timeline">

        <div class="done">

            ✓ Lead Assigned

        </div>

        <div class="done">

            ✓ First Call

        </div>

        <div class="active">

            ● Quote Shared

        </div>

        <div>

            ○ Follow Up

        </div>

        <div>

            ○ Booking

        </div>

    </div>

</div>

`;

}
/* ==========================================================
ACTIVITY
========================================================== */

function renderActivityCard(e){

return `

<div class="crm-card">

    <div class="card-title">

        Recent Activity

    </div>

    <ul class="activity-list">

        <li>📞 Customer called yesterday</li>

        <li>💬 WhatsApp quotation sent</li>

        <li>📅 Follow-up scheduled</li>

        <li>📝 Remarks updated</li>

    </ul>

</div>

`;

}

/* ==========================================================
BOOKING PROGRESS
========================================================== */

function renderProgressTracker(e){

    const steps = [
        "Lead",
        "Enquiry",
        "Follow Up",
        "Booked"
    ];

    let current = 1;

    if(statusIn(e.status,["Follow Up"]))
        current = 2;

    if(isWonEnquiry(e))
        current = 3;

    return `

<div class="detail-card">

    <div class="detail-title">

        Booking Progress

    </div>

    <div class="progress-wrap">

        ${steps.map((step,index)=>`

            <div class="progress-step ${index<=current?"done":""}">

                ${step}

            </div>

        `).join("")}

    </div>

</div>

`;

}
/* ==========================================================
QUICK STATS
========================================================== */

function renderQuickStats(e){

    const daysOpen = e.dateReceived
        ? Math.max(
            1,
            Math.floor(
                (new Date() - new Date(e.dateReceived))
                / (1000*60*60*24)
            )
        )
        : "-";

    return `

<div class="detail-card">

    <div class="detail-title">

        Quick Statistics

    </div>

    <div class="stats-grid">

        <div class="stat-box">

            <div class="stat-value">

                ${e.attempts || 0}

            </div>

            <div class="stat-label">

                Attempts

            </div>

        </div>

        <div class="stat-box">

            <div class="stat-value">

                ${daysOpen}

            </div>

            <div class="stat-label">

                Days Open

            </div>

        </div>

        <div class="stat-box">

            <div class="stat-value">

                ${e.lastActivity || "-"}

            </div>

            <div class="stat-label">

                Last Contact

            </div>

        </div>

    </div>

</div>

`;

}

function renderHotelCard(e){

return `

<div class="detail-card">

    <div class="detail-title">

        Hotel & Travel Preferences

    </div>

    <div class="detail-grid">

        <div class="field">

            <label>Hotel Category</label>

            <select>

                <option>3 Star</option>

                <option>4 Star</option>

                <option>5 Star</option>

            </select>

        </div>

        <div class="field">

            <label>Room Type</label>

            <select>

                <option>Standard</option>

                <option>Deluxe</option>

                <option>Suite</option>

            </select>

        </div>

        <div class="field">

            <label>Meals</label>

            <select>

                <option>Breakfast</option>

                <option>Breakfast + Dinner</option>

                <option>All Meals</option>

            </select>

        </div>

        <div class="field">

            <label>Airport Transfer</label>

            <select>

                <option>Required</option>

                <option>Not Required</option>

            </select>

        </div>

    </div>

</div>

`;

}

/* ==========================================================
TRIP INFORMATION
========================================================== */

function renderTripInfo(e){

return `

<div class="detail-card">

<div class="detail-title">

Trip Details

</div>

<div class="detail-grid">

<div>

<label>Destination</label>

<p>${e.destination || "-"}</p>

</div>

<div>

<label>Tour Zone</label>

<p>${e.tourZone || "-"}</p>

</div>

<div>

<label>Travel Date</label>

<p>

${e.travelDate ?

fmtDate(new Date(e.travelDate))

:

"-"}

</p>

</div>

<div>

<label>PAX</label>

<p>

${e.adults || 0} Adult

${e.children ? "+ "+e.children+" Child" : ""}

</p>

</div>

</div>

</div>

`;

}
/* ==========================================================
GUEST INFORMATION
========================================================== */

function renderGuestInfo(e){

return `

<div class="detail-card">

<div class="detail-title">

Guest Information

</div>

<div class="detail-grid">

<div>

<label>Hub</label>

<p>${e.hub || "-"}</p>

</div>

<div>

<label>Pincode</label>

<p>${e.pincode || "-"}</p>

</div>

<div>

<label>Source</label>

<p>${e.source || "-"}</p>

</div>

<div>

<label>Owner</label>

<p>${e.assignedTo || "-"}</p>

</div>

</div>

</div>

`;

}
/* ==========================================================
BUDGET
========================================================== */

// function renderBudgetCard(e){

// return `

// <div class="detail-card">

// <div class="detail-title">

// Budget

// </div>

// <div class="field">

// <label>Estimated Budget</label>

// <input

// id="enqBudget"

// value="${e.budget || ""}"

// placeholder="Enter budget">

// </div>

// </div>

// `;

// }

function renderBudgetCard(e){

return `

<div class="detail-card">

    <div class="detail-title">

        Budget Information

    </div>

    <div class="field">

        <label>Estimated Budget</label>

        <input
            id="enqBudget"
            value="${e.budget || ""}"
            placeholder="Enter estimated budget">

    </div>

    <div class="detail-grid">

        <div>

            <label>Priority</label>

            <p>${e.priority || "Medium"}</p>

        </div>

        <div>

            <label>Status</label>

            <p>${e.status}</p>

        </div>

    </div>

</div>

`;

}

/* ==========================================================
FOLLOW UP
========================================================== */

// function renderFollowupCard(e){

// return `

// <div class="detail-card">

// <div class="detail-title">

// Follow Up

// </div>

// <div class="detail-grid">

// <div>

// <label>Next Follow Up</label>

// <p>

// ${e.followUpDate ?

// fmtDate(new Date(e.followUpDate))

// :

// "Not Scheduled"}

// </p>

// </div>

// <div>

// <label>Updated</label>

// <p>

// ${e.updatedAt ?

// fmtTimeAgo(e.updatedAt)

// :

// "-"}

// </p>

// </div>

// </div>

// </div>

// `;

// }

function renderFollowupCard(e){

return `

<div class="detail-card">

    <div class="detail-title">

        Follow Up

    </div>

    <div class="detail-grid">

        <div>

            <label>Next Follow Up</label>

            <p>

                ${
                    e.followUpDate
                        ? fmtDate(new Date(e.followUpDate))
                        : "Not Scheduled"
                }

            </p>

        </div>

        <div>

            <label>Updated</label>

            <p>

                ${
                    e.updatedAt
                        ? fmtTimeAgo(e.updatedAt)
                        : "-"

                }

            </p>

        </div>

        <div>

            <label>Attempts</label>

            <p>${e.attempts || 0}</p>

        </div>

        <div>

            <label>Last Activity</label>

            <p>${e.lastActivity || "-"}</p>

        </div>

    </div>

</div>

`;

}


/* ==========================================================
   CUSTOMER TIMELINE
========================================================== */

function renderTimelineCard(e){

    const timeline = [

        {
            title: "Lead Created",
            time: e.dateReceived
                ? fmtDate(new Date(e.dateReceived))
                : "-",
            done: true
        },

        {
            title: "First Contact",
            time: e.lastAttempt
                ? fmtDate(new Date(e.lastAttempt))
                : "Pending",
            done: (e.attempts || 0) > 0
        },

        {
            title: "Follow Up",
            time: e.followUpDate
                ? fmtDate(new Date(e.followUpDate))
                : "Not Scheduled",
            done: e.status === "Follow Up"
        },

        {
            title: "Quotation Shared",
            time: e.updatedAt
                ? fmtTimeAgo(e.updatedAt)
                : "-",
            done: e.status === "Quotation Shared"
        },

        {
            title: "Booking Confirmed",
            time: isWonEnquiry(e)
                ? "Completed"
                : "Pending",
            done: isWonEnquiry(e)
        }

    ];

    return `

<div class="detail-card">

    <div class="detail-title">

        Customer Timeline

    </div>

    <div class="timeline">

        ${timeline.map(item => `

            <div class="timeline-item ${item.done ? "done" : ""}">

                <div class="timeline-dot"></div>

                <div class="timeline-content">

                    <div class="timeline-title">

                        ${item.title}

                    </div>

                    <div class="timeline-time">

                        ${item.time}

                    </div>

                </div>

            </div>

        `).join("")}

    </div>

</div>

`;

}

/* ==========================================================
NOTES
========================================================== */

function renderNotesCard(e){

return `

<div class="detail-card">

    <div class="detail-title">

        Notes

    </div>

    <div class="field">

        <label>Remarks</label>

        <textarea
            id="enqRemarks"
            rows="5"
            placeholder="Write customer notes...">${e.remarks || ""}</textarea>

    </div>

</div>

`;

}
/* ==========================================================
ACTION BUTTONS
========================================================== */

function renderActionButtons(e){

return `

<div class="detail-actions">

    <button
        class="new-enquiry-btn"
        onclick="updateEnquiry('${e.id}')">

        💾 Save Changes

    </button>

    <button
        class="pill-btn"
        onclick="deleteLeadRow('${e.id}')">

        Delete

    </button>

</div>

`;

}

/* ==========================================================
MAIN PAGE
========================================================== */

function renderEnquiries() {

    /* only enquiry statuses */

    let enquiries = LEADS.filter(l =>
        statusIn(l.status, ENQUIRY_STATUSES)
    );

    /* --------------------------------------- */

    const active =
        enquiries.filter(e => !isWonEnquiry(e));

    const won =
        enquiries.filter(isWonEnquiry);

    const lost =
        LEADS.filter(isLostEnquiry);

    let current = active;

    if (AppState.filter === "won")
        current = won;

    if (AppState.filter === "lost")
        current = lost;
    /* Need Attention */

    if (AppState.queue === "attention") {
      current = current.filter(e => {
        if (!e.followUpDate)
            return false;
        return new Date(e.followUpDate) < new Date();
      });
    }

    /* search */

    if (AppState.search) {

        const q = AppState.search.toLowerCase();

        current = current.filter(r =>

            (r.name || "").toLowerCase().includes(q)

            ||

            (r.mobile || "").includes(q)

            ||

            (r.destination || "").toLowerCase().includes(q)

        );

    }

    /* selected enquiry */

    if (
        !current.find(x => x.id === AppState.selected)
    ) {

        AppState.selected =
            current.length
                ? current[0].id
                : null;

    }

    const selected =
        current.find(x => x.id === AppState.selected);

    AppState.enquiry = selected;

    /* --------------------------------------- */

    return `

<div class="page-head">

    <div>

        <h1>Enquiries</h1>

        <p>

            Manage converted guests,
            quotations,
            follow-ups
            and bookings.

        </p>

    </div>

</div>

<div class="counters cols-3">

    <div class="ccard">

        <div class="label">

            Active

        </div>

        <div class="value">

            ${active.length}

        </div>

    </div>

    <div class="ccard good">

        <div class="label">

            Won

        </div>

        <div class="value">

            ${won.length}

        </div>

    </div>

    <div class="ccard bad">

        <div class="label">

            Lost

        </div>

        <div class="value">

            ${lost.length}

        </div>

    </div>

</div>

<div class="enquiries-layout">

    ${renderQueue(current)}

    <div class="enquiry-main">

        ${renderMainHeader(active, won, lost)}

        ${selected
            ? renderEnquiryCard(selected)
            : `
            <div class="ov-card">

                Select an enquiry.

            </div>
        `}

    </div>

</div>

`;

}

/* ==========================================================
LEFT SIDEBAR
========================================================== */

function renderQueue(list){

    return `

<aside class="enquiry-sidebar">

    <div class="sidebar-top">

        <input
            class="queue-search"
            placeholder="Search guest..."

            value="${AppState.search}"

            oninput="AppState.search=this.value;render();">

    </div>


    <div class="queue-switch">

        <button

            class="${AppState.queue==="new"?"active":""}"

            onclick="AppState.queue='new';render();">

            New

        </button>


        <button

            class="${AppState.queue==="attention"?"active":""}"

            onclick="AppState.queue='attention';render();">

            Need Attention

        </button>

    </div>


    <div class="queue-list">

        ${list.length ?

        list.map(e=>renderQueueCard(e)).join("")

        :

        `<div class="empty-row">

            No enquiries found.

        </div>`

        }

    </div>

</aside>

`;

}


/* ==========================================================
QUEUE CARD
========================================================== */

function renderQueueCard(e){

    const active =
        AppState.selected===e.id;

    return `

<div

class="queue-card ${active?"active":""}"

onclick="AppState.selected='${e.id}';render();">

    <div class="queue-name">

        ${e.name}

    </div>


    <div class="queue-mobile">

        ${e.mobileDisplay || e.mobile}

    </div>


    <div class="queue-destination">

        ${e.destination || "Destination not selected"}

    </div>


    <div class="queue-footer">

        <span

        class="status-pill ${cssSafe(e.status)}">

            ${e.status}

        </span>


        <small>

            ${e.assignedTo || ""}

        </small>

    </div>

</div>

`;

}


/* ==========================================================
TOP HEADER
========================================================== */

function renderMainHeader(active,won,lost){

return `

<div class="filters-row">

<button

class="chip ${AppState.filter==="active"?"active":""}"

onclick="AppState.filter='active';render();">

Active

</button>


<button

class="chip ${AppState.filter==="won"?"active":""}"

onclick="AppState.filter='won';render();">

Won

</button>


<button

class="chip ${AppState.filter==="lost"?"active":""}"

onclick="AppState.filter='lost';render();">

Lost

</button>


<div class="search-summary">

${active.length} Active

&nbsp;•&nbsp;

${won.length} Won

&nbsp;•&nbsp;

${lost.length} Lost

</div>

</div>

`;

}

/* ==========================================================
ENQUIRY WORKSPACE
========================================================== */

// function renderEnquiryCard(e){

// return `

// <div class="workspace">

//     ${renderCustomerHeader(e)}

//     <div class="workspace-grid">

//         <div class="workspace-left">

//             ${renderTripInfo(e)}

//             ${renderGuestInfo(e)}

//         </div>

//         <div class="workspace-right">

//             ${renderBudgetCard(e)}

//             ${renderFollowupCard(e)}

//             ${renderNotesCard(e)}

//         </div>

//     </div>

//     ${renderActionButtons(e)}

// </div>

// `;

// }

// function renderEnquiryCard(e){

// return `

// <div class="workspace">

//     ${renderCustomerHeader(e)}

//     <div class="workspace-grid">

//         <div class="workspace-left">

//             ${renderPriorityCard(e)}

//             ${renderProgressCard(e)}

//             ${renderTripInfo(e)}

//             ${renderGuestInfo(e)}

//             ${renderHotelCard(e)}

//         </div>

//         <div class="workspace-right">

//             ${renderBudgetCard(e)}

//             ${renderFollowupCard(e)}

//             ${renderTimelineCard(e)}

//             ${renderActivityCard(e)}

//             ${renderNotesCard(e)}

//         </div>

//     </div>

//     ${renderActionButtons(e)}

// </div>

// `;

// }

function renderEnquiryCard(e){

    return `

<div class="workspace">

    ${renderCustomerHeader(e)}
    ${renderProgressTracker(e)}
    ${renderQuickStats(e)}


    <div class="workspace-grid">

        <div class="workspace-left">

            ${renderTripInfo(e)}

            ${renderGuestInfo(e)}

        </div>

        <div class="workspace-right">

            ${renderBudgetCard(e)}

            ${renderFollowupCard(e)}
            ${renderTimelineCard(e)}
            ${renderHotelCard(e)}



        </div>

    </div>

    ${renderNotesCard(e)}
    ${renderActivityHistory(e)}

    ${renderActionButtons(e)}

</div>

`;

}

async function updateEnquiry(id) {
  const e = LEADS.find((l) => l.id === id); if (!e) return;
  const patch = { budget: document.getElementById('enqBudget').value, remarks: document.getElementById('enqRemarks').value };
  Object.assign(e, patch);
  render();
  await persist(id, patch, '💾 Enquiry updated.');
}

function renderActivityHistory(e){

return `

<div class="detail-card">

    <div class="detail-title">

        Activity History

    </div>

    <ul class="activity-list">

        <li>📞 First Call Completed</li>

        <li>💬 WhatsApp Message Sent</li>

        <li>📧 Quotation Shared</li>

        <li>📝 Follow-up Scheduled</li>

    </ul>

</div>

`;

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
    const newLead =
      rowToLead({
        ...patchToRow(fields),
        Lead_ID: id
      });
    LEADS.unshift(newLead);
    AppState.filter = "active";
    AppState.selected = newLead.id;
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
