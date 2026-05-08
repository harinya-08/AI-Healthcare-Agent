/* ============================================================
   doctor_dashboard.js — MediHealth Doctor Dashboard
   ============================================================ */

const state = {
  doctor: { name: "Doctor", specialty: "", hospital: "" },
  practiceData: null,
  chartTab: "1year",
};

const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ── Toast ── */
function showToast(msg, type = "success") {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast"; t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3200);
}

/* ── Bar chart ── */
function drawBarChart(consultData, checkupData, highlight) {
  const canvas = $("#barChart");
  if (!canvas) return;
  const ctx  = canvas.getContext("2d");
  const W    = canvas.width, H = canvas.height;
  const MONTHS = 12;
  const BAR_W  = Math.floor(W / MONTHS);
  const GAP    = 3;
  const maxVal = Math.max(...consultData, ...checkupData, 1);

  ctx.clearRect(0, 0, W, H);
  for (let i = 0; i < MONTHS; i++) {
    const x    = i * BAR_W;
    const isHL = i === (highlight ?? 4);
    const h2 = Math.round((checkupData[i] / maxVal) * (H - 20));
    ctx.fillStyle = isHL ? "#a8c8ff" : "#dde8ff";
    ctx.beginPath();
    ctx.roundRect(x + GAP + BAR_W / 2 - 4, H - h2, 8, h2, [3, 3, 0, 0]);
    ctx.fill();
    const h1 = Math.round((consultData[i] / maxVal) * (H - 20));
    ctx.fillStyle = isHL ? "#3a86ff" : "#b3ccff";
    ctx.beginPath();
    ctx.roundRect(x + GAP, H - h1, BAR_W / 2 - GAP * 2, h1, [3, 3, 0, 0]);
    ctx.fill();
  }
}

/* ── Donut chart ── */
function drawDonut(patients) {
  const canvas = $("#donutChart");
  if (!canvas) return;
  const ctx    = canvas.getContext("2d");
  const cx = canvas.width / 2, cy = canvas.height / 2, r = 44, thick = 14;
  const COLORS = ["#3a86ff","#1db87a","#f5a623","#7c3aed","#e04040","#0d9488","#f472b6"];
  let slices = [];
  if (patients && patients.length > 0) {
    const map = {};
    patients.forEach(p => {
      const key = p.spec && p.spec !== "—" ? p.spec : "General";
      map[key] = (map[key] || 0) + 1;
    });
    slices = Object.entries(map).map(([name, val], i) => ({
      name, val, color: COLORS[i % COLORS.length]
    }));
  } else {
    slices = [{ name: "No data", val: 1, color: "#edf2f7" }];
  }
  const total = slices.reduce((a, b) => a + b.val, 0);
  let start   = -Math.PI / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  slices.forEach(s => {
    const angle = (s.val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.strokeStyle = s.color;
    ctx.lineWidth   = thick;
    ctx.stroke();
    start += angle;
  });
  const numEl    = $(".donut-num");
  const legendEl = $("#donutLegend");
  if (numEl) numEl.textContent = total > 0 && patients?.length > 0 ? total : "0";
  if (legendEl) {
    legendEl.innerHTML = patients?.length > 0
      ? slices.slice(0, 4).map(s =>
          `<div class="legend-item"><span class="dot" style="background:${s.color}"></span>${s.val} ${s.name}</div>`
        ).join("")
      : `<div class="legend-item"><span class="dot blue"></span>Cardiology</div>
         <div class="legend-item"><span class="dot green"></span>Neurology</div>
         <div class="legend-item"><span class="dot orange"></span>Orthopedics</div>`;
  }
}

/* ── Grade computation ── */
function computeGrades(data) {
  const { notes, totalPatients, prevPatients, satisfactionRaw, recoveryRaw, fillRaw } = data;

  const CONCERN_KEYWORDS = [
    "overload","understaffed","burnout","shortage","delay","backlog","crisis","critical",
    "overwhelmed","high load","no staff","reduced","struggling","problem","issue"
  ];
  const POSITIVE_KEYWORDS = [
    "improving","excellent","great","good","smooth","efficient","well","strong","success",
    "positive","growth","increasing","optimized","effective","stable"
  ];
  const notesLower = (notes || "").toLowerCase();
  let noteScore = 70;
  CONCERN_KEYWORDS.forEach(k => { if (notesLower.includes(k)) noteScore -= 12; });
  POSITIVE_KEYWORDS.forEach(k => { if (notesLower.includes(k)) noteScore += 6; });
  noteScore = Math.max(0, Math.min(100, noteScore));

  const tv   = parseInt(totalPatients) || 0;
  const pv   = parseInt(prevPatients)  || 0;
  const trend = tv >= pv ? 8 : -8;
  const patientScore = Math.min(100, Math.max(0, 50 + trend + Math.min(tv / 5, 30)));

  const satScore  = satisfactionRaw  ? Math.round((parseFloat(satisfactionRaw)  / 10) * 100) : noteScore;
  const recScore  = recoveryRaw      ? parseFloat(recoveryRaw)  : Math.max(0, Math.min(100, noteScore + 10));
  const fillScore = fillRaw          ? parseFloat(fillRaw)      : Math.max(0, Math.min(100, patientScore + 5));

  const toGrade = s => {
    if (s >= 93) return "A+";
    if (s >= 87) return "A";
    if (s >= 80) return "A-";
    if (s >= 73) return "B+";
    if (s >= 65) return "B";
    return "C";
  };
  const toLabel = g => {
    if (g.startsWith("A")) return { pill: "good", note: "Excellent" };
    if (g.startsWith("B")) return { pill: "ok",   note: "Good" };
    return                        { pill: "warn",  note: "Needs Work" };
  };

  const recoveryGrade = toGrade(recScore);
  const fillGrade     = toGrade(fillScore);
  const satGrade      = toGrade(satScore);

  return {
    recoveryGrade,  recoveryPill: toLabel(recoveryGrade).pill,  recoveryNote: toLabel(recoveryGrade).note,
    fillGrade,      fillPill:     toLabel(fillGrade).pill,      fillNote:     toLabel(fillGrade).note,
    satGrade,       satPill:      toLabel(satGrade).pill,       satNote:      toLabel(satGrade).note,
    compositeScore: Math.round((recScore + fillScore + satScore + noteScore) / 4),
    noteScore:      Math.round(noteScore),
    patientScore:   Math.round(patientScore),
  };
}

/* ── Render dashboard ── */
function renderDashboard(data) {
  state.practiceData = data;

  // Doctor name & avatar
  const displayName = data.name.replace(/^Dr\.?\s*/i, "");
  const el_dname = $("#doctorName"); if (el_dname) el_dname.textContent = displayName;
  const el_av    = $("#userAvatar"); if (el_av)    el_av.textContent    = displayName[0]?.toUpperCase() || "D";
  const el_an    = $("#avatarName"); if (el_an)    el_an.textContent    = data.name;

  // Stat cards
  const pv = $("#statPatientsVal"); if (pv) pv.textContent = data.totalPatients || "—";
  const av = $("#statApptsVal");    if (av) av.textContent = data.todayAppts    || "—";

  const pt = $("#statPatientsTrend");
  if (pt && data.totalPatients && data.prevPatients) {
    const diff = parseInt(data.totalPatients) - parseInt(data.prevPatients);
    pt.textContent = diff >= 0 ? `▲ +${diff} vs last period` : `▼ ${diff} vs last period`;
    pt.className   = `stat-trend ${diff >= 0 ? "up" : "down"}`;
  }

  // Grades
  [
    { key: "recovery", grade: data.recoveryGrade, note: data.recoveryNote, pill: data.recoveryPill },
    { key: "fill",     grade: data.fillGrade,     note: data.fillNote,     pill: data.fillPill     },
    { key: "sat",      grade: data.satGrade,      note: data.satNote,      pill: data.satPill      },
  ].forEach(({ key, grade, note, pill }) => {
    const g = $(`#${key}Grade`);
    const p = $(`#${key}Pill`);
    if (g) { g.textContent = grade; g.className = `sum-grade grade-${grade[0].toLowerCase()}`; }
    if (p) { p.textContent = note;  p.className = `sum-pill ${pill}`; }
  });

  // Avg visits
  const avgEl = $("#ovAvgVal");
  if (avgEl) {
    const tv  = parseInt(data.totalPatients) || 0;
    const avg = tv > 0 ? (tv / 12).toFixed(1) : null;
    avgEl.textContent = avg ? `${avg} pts/mo` : "—";
  }

  // Donut
  drawDonut(data.patients || []);

  // Appointments table
  const tbody = $("#apptTableBody");
  if (tbody) {
    tbody.innerHTML = data.appointments?.length
      ? data.appointments.map(a => `
          <tr>
            <td>${a.id}</td><td>${a.patient}</td><td>${a.phone || "—"}</td>
            <td>${a.date}</td><td>${a.time || "—"}</td><td>${a.reason || "—"}</td>
            <td><span class="status ${a.status}">${a.status[0].toUpperCase()+a.status.slice(1)}</span></td>
          </tr>`).join("")
      : `<tr><td colspan="7"><div class="empty-state">
           <i class="fa-regular fa-calendar-xmark"></i><span>No appointments added</span>
         </div></td></tr>`;
  }

  // Recent patients list
  const vList  = $("#visitsList");
  const colors = ["teal","blue","purple","orange","green"];
  if (vList) {
    vList.innerHTML = data.patients?.length
      ? data.patients.map((p, i) => `
          <div class="visit-item">
            <div class="visit-avatar ${colors[i % colors.length]}">${(p.name||"?")[0]}</div>
            <div class="visit-info">
              <div class="visit-name">${p.name}</div>
              <div class="visit-spec">${p.spec}</div>
            </div>
            <div class="visit-time">${p.date || p.time || ""}</div>
          </div>`).join("")
      : `<div class="empty-state">
           <i class="fa-regular fa-user"></i><span>No patients recorded</span>
         </div>`;
  }

  // Bar chart
  if (data.consultData) {
    setTimeout(() => drawBarChart(data.consultData, data.checkupData || Array(12).fill(0), data.chartHighlight ?? 4), 50);
  }

  const dlBtn = $("#downloadBtn");
  if (dlBtn) dlBtn.classList.remove("disabled");
}

/* ── Form helpers ── */
function openModal()  { $("#healthModal").classList.add("open"); }
function closeModal() { $("#healthModal").classList.remove("open"); }

function addApptRow(container, data = {}) {
  const row = document.createElement("div");
  row.className = "appt-row";
  row.innerHTML = `
    <input type="text" placeholder="Patient Name"        value="${data.patient||''}" class="appt-patient"/>
    <input type="text" placeholder="Date (e.g. Apr 20)"  value="${data.date||''}"    class="appt-date"/>
    <input type="text" placeholder="Time (e.g. 10:00 AM)" value="${data.time||''}"   class="appt-time"/>
    <input type="text" placeholder="Reason"              value="${data.reason||''}"  class="appt-reason"/>
    <select class="appt-status">
      <option value="confirmed" ${data.status==="confirmed"?"selected":""}>Confirmed</option>
      <option value="pending"   ${data.status==="pending"  ?"selected":""}>Pending</option>
      <option value="cancelled" ${data.status==="cancelled"?"selected":""}>Cancelled</option>
    </select>
    <button class="btn-icon del" onclick="this.closest('.appt-row').remove()">
      <i class="fa-solid fa-minus"></i>
    </button>`;
  container.appendChild(row);
}

function addVisitRow(container, data = {}) {
  const row = document.createElement("div");
  row.className = "appt-row visit-row-grid";
  row.innerHTML = `
    <input type="text" placeholder="Patient Name"           value="${data.name||''}" class="visit-name-input"/>
    <input type="text" placeholder="Diagnosis / Condition"  value="${data.spec||''}" class="visit-spec-input"/>
    <input type="date" value="${data.date||''}" class="visit-date-input"/>
    <button class="btn-icon del" onclick="this.closest('.appt-row').remove()">
      <i class="fa-solid fa-minus"></i>
    </button>`;
  container.appendChild(row);
}

function collectFormData() {
  const v         = id => $(id)?.value?.trim();
  const numOrNull = id => { const n = parseFloat($(id)?.value); return isNaN(n) ? null : n; };

  const appointments = $$(".appt-row", $("#apptContainer")).map((row, i) => ({
    id:      `#A${1000+i+1}`,
    patient: $(".appt-patient", row)?.value?.trim() || "—",
    phone:   "—",
    date:    $(".appt-date",    row)?.value?.trim() || "—",
    time:    $(".appt-time",    row)?.value?.trim() || "—",
    reason:  $(".appt-reason",  row)?.value?.trim() || "—",
    status:  $(".appt-status",  row)?.value         || "pending",
  })).filter(a => a.patient !== "—");

  const patients = $$(".appt-row", $("#visitContainer")).map(row => ({
    name: $(".visit-name-input", row)?.value?.trim() || "—",
    spec: $(".visit-spec-input", row)?.value?.trim() || "—",
    date: $(".visit-date-input", row)?.value?.trim() || "",
    time: $(".visit-date-input", row)?.value?.trim() || "—",
  })).filter(p => p.name !== "—");

  const parseMonthly = raw => {
    const arr = (raw||"").split(",").map(x => parseFloat(x.trim())).filter(x => !isNaN(x));
    return arr.length === 12 ? arr : Array(12).fill(0);
  };

  const name           = v("#formName")          || "Doctor";
  const specialty      = v("#formSpecialty")      || "";
  const hospital       = v("#formHospital")       || "";
  const totalPatients  = numOrNull("#formTotalPatients") || 0;
  const prevPatients   = numOrNull("#formPrevPatients")  || 0;
  const todayAppts     = numOrNull("#formTodayAppts")    || 0;
  const satisfactionRaw = v("#formSatisfaction")   || null;
  const recoveryRaw    = v("#formRecoveryRate")    || null;
  const fillRaw        = v("#formFillRate")        || null;
  const notes          = v("#formNotes")           || "";

  const grades = computeGrades({ notes, totalPatients, prevPatients, satisfactionRaw, recoveryRaw, fillRaw });

  const consultData = parseMonthly(v("#consultData"));
  const checkupData = parseMonthly(v("#checkupData"));

  const hasMonthly = consultData.some(x => x > 0);
  let finalConsult = consultData;
  let finalCheckup = checkupData;
  if (!hasMonthly && totalPatients > 0) {
    const tv = parseInt(totalPatients) || 0;
    const pv = parseInt(prevPatients)  || 0;
    finalConsult = Array(12).fill(0).map((_, i) =>
      Math.max(0, Math.round(tv / 12) + Math.round(Math.sin(i) * 3)));
    finalCheckup = Array(12).fill(0).map((_, i) =>
      Math.max(0, Math.round(pv / 12) + Math.round(Math.cos(i) * 2)));
  }

  return {
    name, specialty, hospital, totalPatients, prevPatients, todayAppts,
    satisfactionRaw, recoveryRaw, fillRaw, notes,
    ...grades,
    consultData: finalConsult, checkupData: finalCheckup, chartHighlight: 4,
    appointments, patients,
  };
}

/* ── Validation ── */
function validateForm() {
  const name  = $("#formName")?.value?.trim();
  const total = $("#formTotalPatients")?.value?.trim();
  const today = $("#formTodayAppts")?.value?.trim();
  const notes = $("#formNotes")?.value?.trim();
  if (!name) {
    showToast("Please enter your name.", "error");
    $("#formName")?.focus(); return false;
  }
  if (!total || isNaN(parseInt(total))) {
    showToast("Please enter total active patients.", "error");
    $("#formTotalPatients")?.focus(); return false;
  }
  if (!today || isNaN(parseInt(today))) {
    showToast("Please enter today's appointment count.", "error");
    $("#formTodayAppts")?.focus(); return false;
  }
  if (!notes || notes.length < 10) {
    showToast("Please describe your practice notes (at least 10 characters).", "error");
    $("#formNotes")?.focus(); return false;
  }
  return true;
}

/* ── Form submit ── */
function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const btn      = $("#formSubmitBtn");
  const progress = $("#agentProgress");
  const runAgent = $("#runAgentAnalysis")?.checked ?? true;

  btn.disabled  = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing…';
  if (progress) progress.classList.remove("hidden");

  const formData = collectFormData();

  // Try backend save, fall back to local
  fetch("/api/doctor-data", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(formData),
  })
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(resp => ({ ...formData, ...resp }))
  .catch(() => formData)
  .then(merged => {
    renderDashboard(merged);
    state.practiceData = merged;
    try { sessionStorage.setItem("medihealth_doctor_data", JSON.stringify(merged)); } catch(ex) {}

    if (!runAgent) {
      closeModal();
      showToast("Dashboard updated!", "success");
      resetSubmitBtn(btn, progress);
      return;
    }

    setAgentProgressStep("Sending data to MediAgent…", 1);
    runAgentAnalysis(merged)
      .then(analysis => {
        setAgentProgressStep("Building your report…", 2);
        const reportHTML = buildReportHTML(merged, analysis);
        try {
          sessionStorage.setItem("medihealth_doctor_report",    reportHTML);
          sessionStorage.setItem("medihealth_doctor_report_ts", new Date().toISOString());
        } catch(ex) {}
        setAgentProgressStep("Report ready!", 3);
        setTimeout(() => {
          closeModal();
          resetSubmitBtn(btn, progress);
          showReportAlert(merged.name);
        }, 600);
      })
      .catch(() => {
        closeModal();
        resetSubmitBtn(btn, progress);
        showToast("Dashboard updated. Agent analysis unavailable.", "success");
      });
  });
}

function resetSubmitBtn(btn, progress) {
  btn.disabled  = false;
  btn.innerHTML = '<i class="fa-solid fa-chart-line"></i> Generate Dashboard';
  if (progress) progress.classList.add("hidden");
}

function setAgentProgressStep(msg, step) {
  const label = $("#agentProgressLabel");
  const bar   = $("#agentProgressBar");
  if (label) label.textContent = msg;
  if (bar)   bar.style.width   = `${(step / 3) * 100}%`;
}

/* ── MediAgent analysis ── */
async function runAgentAnalysis(data) {
  const systemPrompt = `You are MediAgent, a professional AI clinical practice analyst.
Analyse the doctor's practice data thoroughly and produce a structured analysis with these EXACT sections:
1. PRACTICE PERFORMANCE SCORE (0-100)
2. PATIENT LOAD ASSESSMENT
3. APPOINTMENT & SCHEDULING REVIEW
4. PATIENT SATISFACTION ANALYSIS
5. RECOVERY RATE OVERVIEW
6. KEY CHALLENGES & RISK FACTORS
7. PERSONALISED RECOMMENDATIONS (at least 5 actionable points for improving practice)
8. FOLLOW-UP ACTIONS
Be specific, reference actual values. Use a professional but empathetic tone.
Always end with: "This report is AI-generated. Always use professional clinical judgment."`;

  const userMsg = `Please analyse the following doctor's practice data and generate a full practice performance report:
Doctor Name: ${data.name}
Specialty: ${data.specialty || "Not specified"}
Hospital/Clinic: ${data.hospital || "Not specified"}
Total Active Patients: ${data.totalPatients || 0}
Previous Period Patients: ${data.prevPatients || 0}
Today's Appointments: ${data.todayAppts || 0}
Patient Satisfaction: ${data.satisfactionRaw || "Not provided"}/10
Recovery Rate: ${data.recoveryRaw || "Not provided"}%
Appointment Fill Rate: ${data.fillRaw || "Not provided"}%
Recovery Grade: ${data.recoveryGrade} | Fill Rate Grade: ${data.fillGrade} | Satisfaction Grade: ${data.satGrade}
Composite Score: ${data.compositeScore}/100
Practice Notes: ${data.notes}
Upcoming Appointments: ${JSON.stringify(data.appointments)}
Recent Patients: ${JSON.stringify(data.patients)}`;

  const resp = await fetch("/chat", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ message: userMsg, history: [], system: systemPrompt }),
  });
  if (!resp.ok) throw new Error("Agent unavailable");
  const json = await resp.json();
  return json.response || "";
}

/* ── Report alert ── */
function showReportAlert(name) {
  const existing = $("#reportAlert");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.id = "reportAlert"; el.className = "report-alert";
  el.innerHTML = `
    <div class="report-alert-icon"><i class="fa-solid fa-circle-check"></i></div>
    <div class="report-alert-body">
      <strong>
        <i class="fa-solid fa-robot" style="color:var(--blue);font-size:11px;margin-right:3px"></i>
        Practice Report Ready, ${name}!
      </strong>
      <span>Your MediAgent practice performance report has been generated. Download it now.</span>
    </div>
    <button class="report-alert-close" onclick="dismissReportAlert()" aria-label="Close">
      <i class="fa-solid fa-xmark"></i>
    </button>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("report-alert-visible")));
  setTimeout(() => dismissReportAlert(), 12000);
}

function dismissReportAlert() {
  const el = $("#reportAlert");
  if (!el) return;
  el.classList.remove("report-alert-visible");
  setTimeout(() => el.remove(), 400);
}

/* ── Download report ── */
function downloadReport() {
  const data = state.practiceData;
  if (!data) { showToast("Please fill in your practice data first.", "error"); return; }

  const stored = sessionStorage.getItem("medihealth_doctor_report");
  if (stored) {
    window.open(URL.createObjectURL(new Blob([stored], { type: "text/html" })), "_blank");
    showToast("Report opened — use Print → Save as PDF", "success");
    return;
  }

  fetch("/api/download-doctor-report", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  })
  .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
  .then(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href = url; a.download = `${data.name}_practice_report.pdf`;
    a.click(); URL.revokeObjectURL(url);
    showToast("Report downloaded!", "success");
  })
  .catch(() => generateBasicHTMLReport(data));
}

function generateBasicHTMLReport(data) {
  const now  = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  const apptRows = (data.appointments||[]).map(a =>
    `<tr><td>${a.id}</td><td>${a.patient}</td><td>${a.date}</td><td>${a.time}</td><td>${a.reason}</td><td>${a.status}</td></tr>`
  ).join("") || "<tr><td colspan='6'>No appointments</td></tr>";
  const patientRows = (data.patients||[]).map(p =>
    `<tr><td>${p.name}</td><td>${p.spec}</td><td>${p.date||p.time||"—"}</td></tr>`
  ).join("") || "<tr><td colspan='3'>No patients</td></tr>";
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Practice Report – ${data.name}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;background:#fff;color:#111;padding:40px;max-width:800px;margin:auto}
h1{font-size:26px;font-weight:800;margin-bottom:4px}.blue{color:#3a86ff}
.sec{margin-bottom:28px}.sec h2{font-size:14px;font-weight:700;border-bottom:2px solid #e8edf5;padding-bottom:6px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;font-size:10px;font-weight:700;color:#9ca3af;padding:7px 10px;border-bottom:1px solid #e8edf5}
td{padding:8px 10px;border-bottom:1px solid #f4f7fc}footer{margin-top:32px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e8edf5;padding-top:12px}
@media print{body{padding:20px}}</style></head><body>
<h1>Medi<span class="blue">Health</span> Practice Report</h1>
<p style="color:#6b7280;font-size:13px;margin-bottom:28px">Report for <strong>${data.name}</strong> &nbsp;·&nbsp; ${now}</p>
<div class="sec"><h2>Practice Score</h2><p>Composite: <strong>${data.compositeScore||"—"}/100</strong></p></div>
<div class="sec"><h2>Grades</h2><p>Recovery Rate: ${data.recoveryGrade} | Fill Rate: ${data.fillGrade} | Satisfaction: ${data.satGrade}</p></div>
<div class="sec"><h2>Appointments</h2><table><thead><tr><th>ID</th><th>Patient</th><th>Date</th><th>Time</th><th>Reason</th><th>Status</th></tr></thead><tbody>${apptRows}</tbody></table></div>
<div class="sec"><h2>Recent Patients</h2><table><thead><tr><th>Patient</th><th>Diagnosis</th><th>Date</th></tr></thead><tbody>${patientRows}</tbody></table></div>
<footer>MediHealth &nbsp;·&nbsp; For internal practice use only. Always use professional clinical judgment.</footer>
<script>window.print();<\/script></body></html>`;
  window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
  showToast("Report opened — use Print → Save as PDF", "success");
}

/* ── Build full report HTML ── */
function buildReportHTML(data, agentAnalysis) {
  const now  = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  const time = new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });
  const apptRows = (data.appointments||[]).map(a =>
    `<tr><td>${a.id}</td><td>${a.patient}</td><td>${a.date}</td><td>${a.time}</td><td>${a.reason}</td>
     <td><span class="status-badge ${a.status}">${a.status}</span></td></tr>`
  ).join("") || "<tr><td colspan='6' class='empty'>No appointments recorded</td></tr>";
  const patientRows = (data.patients||[]).map(p =>
    `<tr><td>${p.name}</td><td>${p.spec}</td><td>${p.date||p.time||"—"}</td></tr>`
  ).join("") || "<tr><td colspan='3' class='empty'>No patients recorded</td></tr>";
  const analysisHTML = agentAnalysis
    ? agentAnalysis.split("\n").map(line => {
        if (/^\d+\./.test(line.trim())) return `<h3 class="analysis-section">${line.trim()}</h3>`;
        if (line.trim().startsWith("-") || line.trim().startsWith("•"))
          return `<li>${line.replace(/^[-•]\s*/,"").trim()}</li>`;
        return line.trim() ? `<p>${line.trim()}</p>` : "";
      }).join("\n").replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul>${m}</ul>`)
    : "<p>No agent analysis available.</p>";

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Practice Report — ${data.name}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#f4f7fc;color:#111827}
.report-page{max-width:860px;margin:0 auto;padding:40px 24px 80px}
.rpt-header{background:#fff;border-radius:20px;padding:28px 32px;margin-bottom:24px;border:1px solid #e8edf5;display:flex;align-items:center;justify-content:space-between;gap:20px}
.brand-icon{width:44px;height:44px;background:#3a86ff;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px}
.brand-name{font-family:'Sora',sans-serif;font-size:20px;font-weight:700}.brand-name span{color:#3a86ff}
.rpt-meta{text-align:right}.rpt-meta h2{font-family:'Sora',sans-serif;font-size:17px;font-weight:700;margin-bottom:4px}.rpt-meta p{font-size:12px;color:#9ca3af}
.score-banner{background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;padding:24px 32px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.score-circle{width:72px;height:72px;border-radius:50%;background:#fff;border:3px solid #3a86ff;display:flex;align-items:center;justify-content:center;flex-direction:column}
.score-num{font-family:'Sora',sans-serif;font-size:22px;font-weight:800;color:#3a86ff;line-height:1}
.score-lbl{font-size:9px;color:#6b7280;text-transform:uppercase}
.score-stats{display:flex;gap:16px}
.score-stat{text-align:center;background:rgba(255,255,255,.7);border-radius:12px;padding:10px 16px;border:1px solid #bfdbfe}
.score-stat .val{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;line-height:1;margin-bottom:2px}
.score-stat .lbl{font-size:10px;color:#6b7280;text-transform:uppercase}
.grades-row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px}
.grade-card{background:#fff;border-radius:16px;padding:18px;border:1px solid #e8edf5;text-align:center}
.gc-cat{font-size:10px;font-weight:600;text-transform:uppercase;color:#9ca3af;margin-bottom:6px}
.gc-val{font-family:'Sora',sans-serif;font-size:28px;font-weight:800;line-height:1;margin-bottom:6px}
.gc-val.a{color:#1db87a}.gc-val.b{color:#3a86ff}.gc-val.c{color:#f5a623}
.section-card{background:#fff;border-radius:16px;padding:22px 24px;margin-bottom:18px;border:1px solid #e8edf5}
.section-card h2{font-family:'Sora',sans-serif;font-size:15px;font-weight:700;margin-bottom:16px}
.analysis-wrap{line-height:1.75;color:#374151;font-size:14px}
.analysis-wrap h3{font-family:'Sora',sans-serif;font-size:13px;font-weight:700;background:#f4f7fc;padding:8px 12px;border-radius:8px;margin:16px 0 8px;border-left:3px solid #3a86ff}
.analysis-wrap p{margin-bottom:8px}.analysis-wrap ul{padding-left:20px;margin-bottom:10px}.analysis-wrap li{margin-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;padding:8px 10px;border-bottom:1px solid #e8edf5}
td{padding:10px;border-bottom:1px solid #f4f7fc;color:#374151}
.status-badge{font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;text-transform:capitalize}
.status-badge.confirmed{background:#e8faf3;color:#1db87a}.status-badge.pending{background:#fff3e0;color:#e07b00}.status-badge.cancelled{background:#fff0f0;color:#e04040}
td.empty{color:#9ca3af;font-style:italic;text-align:center;padding:16px}
.disclaimer{background:#fff3e0;border:1px solid #fed7aa;border-radius:10px;padding:12px 16px;margin-top:16px;font-size:12px;color:#92400e;display:flex;align-items:center;gap:8px}
.print-btn{display:inline-flex;align-items:center;gap:8px;margin-top:20px;background:#3a86ff;color:#fff;border:none;border-radius:10px;padding:11px 22px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer}
.rpt-footer{text-align:center;font-size:11px;color:#9ca3af;margin-top:32px;padding-top:20px;border-top:1px solid #e8edf5}
@media print{body{background:#fff}.report-page{padding:20px}.print-btn{display:none}}
</style></head><body>
<div class="report-page">
  <div class="rpt-header">
    <div style="display:flex;align-items:center;gap:12px">
      <div class="brand-icon"><i class="fa-solid fa-heart-pulse"></i></div>
      <div><div class="brand-name">Medi<span>Health</span></div><div style="font-size:11px;color:#9ca3af">Doctor Practice Report</div></div>
    </div>
    <div class="rpt-meta"><h2>${data.name}</h2><p>${data.specialty||""} ${data.hospital ? "· "+data.hospital : ""}</p><p>Generated ${now} at ${time}</p><p style="margin-top:3px;color:#3a86ff;font-weight:600;font-size:11px">Analysed by MediAgent AI</p></div>
  </div>
  <div class="score-banner">
    <div style="display:flex;align-items:center;gap:16px">
      <div class="score-circle"><div class="score-num">${data.compositeScore||75}</div><div class="score-lbl">Score</div></div>
      <div>
        <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:700;margin-bottom:4px">Practice Performance Score</div>
        <div style="font-size:13px;color:#6b7280">Note Score: ${data.noteScore||"—"} &nbsp;·&nbsp; Patient Score: ${data.patientScore||"—"}</div>
      </div>
    </div>
    <div class="score-stats">
      <div class="score-stat"><div class="val" style="color:#3a86ff">${data.totalPatients||0}</div><div class="lbl">Active Patients</div></div>
      <div class="score-stat"><div class="val" style="color:#1db87a">${data.todayAppts||0}</div><div class="lbl">Today's Appts</div></div>
      <div class="score-stat"><div class="val" style="color:#7c3aed">${data.satisfactionRaw||"—"}</div><div class="lbl">Satisfaction/10</div></div>
    </div>
  </div>
  <div class="grades-row">
    <div class="grade-card"><div class="gc-cat">Recovery Rate</div><div class="gc-val ${(data.recoveryGrade||"C")[0].toLowerCase()}">${data.recoveryGrade||"—"}</div></div>
    <div class="grade-card"><div class="gc-cat">Appt Fill Rate</div><div class="gc-val ${(data.fillGrade||"C")[0].toLowerCase()}">${data.fillGrade||"—"}</div></div>
    <div class="grade-card"><div class="gc-cat">Patient Satisfaction</div><div class="gc-val ${(data.satGrade||"C")[0].toLowerCase()}">${data.satGrade||"—"}</div></div>
  </div>
  <div class="section-card">
    <h2><i class="fa-solid fa-robot" style="color:#3a86ff;margin-right:6px"></i>MediAgent Full Analysis</h2>
    <div class="analysis-wrap">${analysisHTML}</div>
  </div>
  <div class="section-card">
    <h2><i class="fa-solid fa-calendar-days" style="color:#3a86ff;margin-right:6px"></i>Upcoming Appointments</h2>
    <table><thead><tr><th>ID</th><th>Patient</th><th>Date</th><th>Time</th><th>Reason</th><th>Status</th></tr></thead><tbody>${apptRows}</tbody></table>
  </div>
  <div class="section-card">
    <h2><i class="fa-solid fa-users" style="color:#3a86ff;margin-right:6px"></i>Recent Patients</h2>
    <table><thead><tr><th>Patient</th><th>Diagnosis / Condition</th><th>Date</th></tr></thead><tbody>${patientRows}</tbody></table>
  </div>
  ${data.notes ? `<div class="section-card"><h2>Practice Notes</h2><p style="font-size:14px;color:#4b5563;line-height:1.7">${data.notes}</p></div>` : ""}
  <div class="disclaimer"><i class="fa-solid fa-triangle-exclamation"></i>This report is generated by MediAgent AI for informational purposes only. Always apply professional clinical judgment in patient care decisions.</div>
  <button class="print-btn" onclick="window.print()"><i class="fa-solid fa-print"></i> Print / Save as PDF</button>
  <div class="rpt-footer">MediHealth &nbsp;·&nbsp; Report ID: DR-${Date.now().toString(36).toUpperCase()} &nbsp;·&nbsp; ${now}</div>
</div></body></html>`;
}

/* ── MediAgent chat panel ── */
function toggleAgent() { $("#agentPanel").classList.toggle("open"); }

function sendAgentMessage() {
  const input = $("#agentInput");
  const msg   = input.value.trim();
  if (!msg) return;
  const body = $("#agentBody");
  const userBubble = document.createElement("div");
  userBubble.className   = "agent-user-msg";
  userBubble.textContent = msg;
  body.appendChild(userBubble);
  input.value = "";
  body.scrollTop = body.scrollHeight;

  const systemCtx = state.practiceData
    ? `You are MediAgent, an AI clinical assistant. Doctor: ${state.practiceData.name}, Specialty: ${state.practiceData.specialty||"General"}, Hospital: ${state.practiceData.hospital||"—"}, Active Patients: ${state.practiceData.totalPatients}, Today's Appointments: ${state.practiceData.todayAppts}, Recovery Grade: ${state.practiceData.recoveryGrade}, Fill Rate Grade: ${state.practiceData.fillGrade}, Satisfaction Grade: ${state.practiceData.satGrade}, Score: ${state.practiceData.compositeScore}/100. Give concise, professional clinical and practice management advice. Always remind to apply clinical judgment.`
    : "You are MediAgent, a professional AI clinical assistant for physicians. Give concise, helpful practice management and clinical guidance. Always remind to apply professional judgment.";

  fetch("/chat", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ message: msg, history: [], system: systemCtx }),
  })
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(d  => appendBotMsg(body, d.response || "I'm here to help!"))
  .catch(() => appendBotMsg(body, "Please apply your professional clinical judgment for patient care decisions."));
}

function appendBotMsg(container, text) {
  const resp = document.createElement("div");
  resp.className = "agent-bot-msg";
  resp.innerHTML = `<i class="fa-solid fa-robot"></i><span>${text}</span>`;
  container.appendChild(resp);
  container.scrollTop = container.scrollHeight;
}

/* ── Tabs ── */
function initTabs() {
  $$(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.chartTab = btn.textContent;
      if (state.practiceData?.consultData) {
        drawBarChart(state.practiceData.consultData, state.practiceData.checkupData, state.practiceData.chartHighlight);
      }
    });
  });
}

/* ── Init ── */
document.addEventListener("DOMContentLoaded", () => {
  $("#openFormBtn")?.addEventListener("click",  openModal);
  $("#modalCloseBtn")?.addEventListener("click", closeModal);
  $("#healthModal")?.addEventListener("click", e => {
    if (e.target === $("#healthModal")) closeModal();
  });
  $("#addApptBtn")?.addEventListener("click",  () => addApptRow($("#apptContainer")));
  $("#addVisitBtn")?.addEventListener("click", () => addVisitRow($("#visitContainer")));
  $("#healthForm")?.addEventListener("submit", handleFormSubmit);
  $("#downloadBtn")?.addEventListener("click", downloadReport);
  $("#agentInput")?.addEventListener("keydown", e => { if (e.key === "Enter") sendAgentMessage(); });
  $("#openAgentNav")?.addEventListener("click", e => { e.preventDefault(); toggleAgent(); });
  initTabs();
  drawDonut(null);
  setTimeout(() => {
    drawBarChart(
      [18,22,20,25,30,24,28,26,30,28,32,35],
      [12,16,15,18,22,18,22,20,24,22,26,28],
      4
    );
  }, 100);
  try {
    const stored = sessionStorage.getItem("medihealth_doctor_data");
    if (stored) renderDashboard(JSON.parse(stored));
  } catch(ex) {}
  const autoOpen = new URLSearchParams(window.location.search).get("openForm") === "1";
  if (autoOpen) setTimeout(() => openModal(), 100);
});
window.toggleAgent        = toggleAgent;
window.sendAgentMessage   = sendAgentMessage;
window.openModal          = openModal;
window.closeModal         = closeModal;
window.dismissReportAlert = dismissReportAlert;