/* ============================================================
   dashboard.js — MediHealth Dashboard
   ============================================================ */

const state = {
  user: { name: "User", avatarLetter: "U", bpm: null, bpmStatus: "—" },
  healthData: null,
  chartTab: "1year",
};

/* Single $ definition — CSS selector style, scoped to document */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ── Toast ── */
function showToast(msg, type = "success") {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3200);
}

/* ── Heartbeat canvas ── */
function initHeartbeat(bpmValue) {
  const canvas = $("#hbCanvas");
  if (!canvas) return;
  const ctx  = canvas.getContext("2d");
  const W    = canvas.width, H = canvas.height;
  const base = [0,0,0,0,0,0,-18,30,-10,-28,20,6,0,0,0,0,0,0];
  let offset = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    const step = W / (base.length - 1);
    ctx.moveTo(0, H / 2 + base[0]);
    for (let i = 1; i < base.length; i++) {
      ctx.lineTo(i * step, H / 2 + base[(i + offset) % base.length]);
    }
    ctx.strokeStyle = "#1db87a";
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = "round";
    ctx.stroke();
    offset = (offset + 1) % base.length;
    setTimeout(() => requestAnimationFrame(draw), 80);
  }
  draw();
  if (bpmValue) {
    const bpmEl   = $("#bpmVal");
    const badgeEl = $("#bpmBadge");
    if (bpmEl)   bpmEl.textContent   = bpmValue;
    if (badgeEl) {
      const isHigh        = bpmValue > 100;
      badgeEl.textContent = isHigh ? "High" : "Normal";
      badgeEl.className   = `bpm-badge ${isHigh ? "high" : "normal"}`;
    }
  }
}

/* ── Donut (dashboard visits widget, uses raw canvas — NOT Chart.js) ── */
function drawDonut(visits) {
  const canvas = $("#donutChart");
  if (!canvas) return;
  const ctx    = canvas.getContext("2d");
  const cx = canvas.width / 2, cy = canvas.height / 2, r = 44, thick = 14;
  const SPECIALTY_COLORS = [
    "#1db87a","#3a86ff","#f5a623","#7c3aed","#e04040","#0d9488","#f472b6"
  ];
  let slices = [];
  if (visits && visits.length > 0) {
    const specMap = {};
    visits.forEach(v => {
      const key = v.spec && v.spec !== "—" ? v.spec : "General";
      specMap[key] = (specMap[key] || 0) + 1;
    });
    slices = Object.entries(specMap).map(([name, val], i) => ({
      name, val, color: SPECIALTY_COLORS[i % SPECIALTY_COLORS.length]
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
  const legendEl = $(".donut-legend");
  if (numEl) numEl.textContent = total > 0 ? total : "0";
  if (legendEl) {
    if (visits && visits.length > 0) {
      legendEl.innerHTML = slices.slice(0, 3).map(s =>
        `<div class="legend-item">
           <span class="dot" style="background:${s.color}"></span>
           ${s.val} ${s.name}
         </div>`
      ).join("");
    } else {
      legendEl.innerHTML = `
        <div class="legend-item"><span class="dot green"></span>149 Neurology</div>
        <div class="legend-item"><span class="dot blue"></span>50 Oncology</div>
        <div class="legend-item"><span class="dot orange"></span>45 Urology</div>`;
    }
  }
}

/* ── Dashboard bar chart (overview section) ── */
let dashBarChart = null;
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
    const isHL = i === (highlight || 4);
    /* previous period bar (lighter) */
    const h2 = Math.round((checkupData[i] / maxVal) * (H - 20));
    ctx.fillStyle = isHL ? "#a8c8ff" : "#dde8ff";
    ctx.beginPath();
    ctx.roundRect(x + GAP + BAR_W / 2 - 4, H - h2, 8, h2, [3, 3, 0, 0]);
    ctx.fill();
    /* current period bar */
    const h1 = Math.round((consultData[i] / maxVal) * (H - 20));
    ctx.fillStyle = isHL ? "#1db87a" : "#b3e8d4";
    ctx.beginPath();
    ctx.roundRect(x + GAP, H - h1, BAR_W / 2 - GAP * 2, h1, [3, 3, 0, 0]);
    ctx.fill();
  }
}

/* ── Grade computation ── */
function computeGrades(data) {
  const { symptoms, totalVisits, previousVisits, bpm } = data;
  const SEVERE_KEYWORDS = [
    "chest pain","heart attack","stroke","seizure","unconscious","breathing difficulty",
    "severe pain","blood","cancer","tumor","fracture","paralysis","vision loss","fainting",
    "high fever","infection","surgery","icu","hospitalized","vomiting blood"
  ];
  const MODERATE_KEYWORDS = [
    "pain","ache","fatigue","tired","dizzy","nausea","shortness","anxiety","depression",
    "insomnia","migraine","headache","swelling","rash","cough","fever","diabetes",
    "hypertension","asthma","allergy","back pain","joint","irregular","palpitation"
  ];
  const MILD_KEYWORDS = [
    "mild","slight","minor","occasional","stress","cold","sneeze","runny","sore throat",
    "stiffness","bruise","dry skin","bloating","gas","constipation"
  ];
  const symLower = (symptoms || "").toLowerCase();
  let symScore   = 100;
  SEVERE_KEYWORDS.forEach(k   => { if (symLower.includes(k)) symScore -= 35; });
  MODERATE_KEYWORDS.forEach(k => { if (symLower.includes(k)) symScore -= 12; });
  MILD_KEYWORDS.forEach(k     => { if (symLower.includes(k)) symScore -= 5;  });
  symScore = Math.max(0, Math.min(100, symScore));

  const tv         = parseInt(totalVisits)    || 0;
  const pv         = parseInt(previousVisits) || 0;
  const visitRatio = tv > 0 ? Math.min(tv / 4, 1) : 0;
  const visitTrend = tv >= pv ? 5 : -10;
  let visitScore   = visitRatio * 80 + visitTrend + 15;
  visitScore       = Math.max(0, Math.min(100, visitScore));

  let bpmScore = 100;
  const b = parseInt(bpm) || 0;
  if (b) {
    if      (b < 40 || b > 130) bpmScore = 20;
    else if (b < 50 || b > 110) bpmScore = 50;
    else if (b < 60 || b > 100) bpmScore = 75;
    else                         bpmScore = 100;
  }

  const composite    = (symScore * 0.50) + (visitScore * 0.30) + (bpmScore * 0.20);
  const vitalsScore  = (symScore * 0.55) + (bpmScore  * 0.30) + (visitScore * 0.15);
  const medScore     = (visitScore * 0.50) + (symScore * 0.35) + (bpmScore * 0.15);
  const mentalScore  = (symScore * 0.60) + (visitScore * 0.25) + (bpmScore * 0.15);

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

  const vitalsGrade = toGrade(vitalsScore);
  const medGrade    = toGrade(medScore);
  const mentalGrade = toGrade(mentalScore);

  return {
    vitalsGrade,  vitalsPill: toLabel(vitalsGrade).pill, vitalsNote: toLabel(vitalsGrade).note,
    medGrade,     medPill:    toLabel(medGrade).pill,    medNote:    toLabel(medGrade).note,
    mentalGrade,  mentalPill: toLabel(mentalGrade).pill, mentalNote: toLabel(mentalGrade).note,
    compositeScore: Math.round(composite),
    symScore:    Math.round(symScore),
    visitScore:  Math.round(visitScore),
    bpmScore:    Math.round(bpmScore),
  };
}

/* ── Render dashboard ── */
function renderDashboard(data) {
  state.healthData = data;
  ["#userName","#agentUserName"].forEach(sel => {
    const el = $(sel); if (el) el.textContent = data.name;
  });
  const av = $("#userAvatar"); if (av) av.textContent = data.name[0].toUpperCase();
  const an = $("#avatarName"); if (an) an.textContent = data.name;

  initHeartbeat(data.bpm);
  drawDonut(data.visits || []);

  [
    { key: "vitals", grade: data.vitalsGrade, note: data.vitalsNote, pill: data.vitalsPill },
    { key: "med",    grade: data.medGrade,    note: data.medNote,    pill: data.medPill    },
    { key: "mental", grade: data.mentalGrade, note: data.mentalNote, pill: data.mentalPill },
  ].forEach(({ key, grade, note, pill }) => {
    const g = $(`#${key}Grade`);
    const p = $(`#${key}Pill`);
    if (g) { g.textContent = grade; g.className = `sum-grade grade-${grade[0].toLowerCase()}`; }
    if (p) { p.textContent = note;  p.className = `sum-pill ${pill}`; }
  });

  const avgEl = $("#ovAvgVal");
  if (avgEl) {
    const tv  = parseInt(data.totalVisits) || 0;
    const avg = tv > 0 ? (tv / 12).toFixed(1) : null;
    avgEl.textContent = avg ? `${avg} visits/mo` : (data.avgMonthlyLabel || "—");
  }

  /* Appointments table */
  const tbody = $("#apptTableBody");
  if (tbody) {
    tbody.innerHTML = data.appointments?.length
      ? data.appointments.map(a => `
          <tr>
            <td>${a.id}</td><td>${a.dr}</td><td>${a.phone}</td>
            <td>${a.date}</td><td>${a.time}</td>
            <td><span class="status ${a.status}">${a.status[0].toUpperCase()+a.status.slice(1)}</span></td>
          </tr>`).join("")
      : `<tr><td colspan="6"><div class="empty-state">
           <i class="fa-regular fa-calendar-xmark"></i><span>No appointments added</span>
         </div></td></tr>`;
  }

  /* Visits list */
  const vList  = $("#visitsList");
  const colors = ["teal","blue","purple","orange","green"];
  if (vList) {
    vList.innerHTML = data.visits?.length
      ? data.visits.map((v, i) => `
          <div class="visit-item">
            <div class="visit-avatar ${colors[i % colors.length]}">${(v.name||"?")[0]}</div>
            <div class="visit-info">
              <div class="visit-name">${v.name}</div>
              <div class="visit-spec">${v.spec}</div>
            </div>
            <div class="visit-time">${v.time || v.date || ""}</div>
          </div>`).join("")
      : `<div class="empty-state">
           <i class="fa-regular fa-user-doctor"></i><span>No visits recorded</span>
         </div>`;
  }

  /* Draw overview bar chart with real data */
  if (data.consultData) {
    setTimeout(() => drawBarChart(data.consultData, data.checkupData || Array(12).fill(0), data.chartHighlight || 4), 50);
  }

  const dlBtn = $("#downloadBtn");
  if (dlBtn) dlBtn.classList.remove("disabled");
}

/* ── Form helpers ── */
let apptRowCount  = 1;
let visitRowCount = 1;

function openModal()  { $("#healthModal").classList.add("open"); }
function closeModal() { $("#healthModal").classList.remove("open"); }

function addApptRow(container, data = {}) {
  apptRowCount++;
  const row = document.createElement("div");
  row.className = "appt-row";
  row.innerHTML = `
    <input type="text" placeholder="Doctor Name" value="${data.dr||''}" class="appt-dr"/>
    <input type="text" placeholder="Date (e.g. July 10)" value="${data.date||''}" class="appt-date"/>
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
  visitRowCount++;
  const row = document.createElement("div");
  row.className = "appt-row";
  row.innerHTML = `
    <input type="text" placeholder="Doctor Name"          value="${data.name||''}" class="visit-name-input"/>
    <input type="text" placeholder="Speciality"           value="${data.spec||''}" class="visit-spec-input"/>
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
    id:     `#1000${i+1}`,
    dr:     $(".appt-dr",     row)?.value?.trim() || "—",
    phone:  "+N/A",
    date:   $(".appt-date",   row)?.value?.trim() || "—",
    time:   "—",
    status: $(".appt-status", row)?.value || "pending",
  })).filter(a => a.dr !== "—");

  /* Collect visits — store date for chart use in report */
  const visits = $$(".appt-row", $("#visitContainer")).map(row => ({
    name: $(".visit-name-input", row)?.value?.trim() || "—",
    spec: $(".visit-spec-input", row)?.value?.trim() || "—",
    date: $(".visit-date-input", row)?.value?.trim() || "",
    time: $(".visit-date-input", row)?.value?.trim() || "—",
  })).filter(vv => vv.name !== "—");

  const parseMonthly = raw => {
    const arr = (raw||"").split(",").map(x => parseFloat(x.trim())).filter(x => !isNaN(x));
    return arr.length === 12 ? arr : Array(12).fill(0);
  };

  const name           = v("#formName")           || "User";
  const bpm            = numOrNull("#formBpm");
  const symptoms       = v("#formSymptoms")        || "";
  const totalVisits    = numOrNull("#formTotalVisits")    || 0;
  const previousVisits = numOrNull("#formPreviousVisits") || 0;
  const grades         = computeGrades({ symptoms, totalVisits, previousVisits, bpm });
  const consultData    = parseMonthly(v("#consultData"));
  const checkupData    = parseMonthly(v("#checkupData"));

  const hasMonthly = consultData.some(x => x > 0);
  let finalConsult = consultData;
  let finalCheckup = checkupData;

  if (!hasMonthly && (totalVisits > 0 || previousVisits > 0)) {
    const tv = parseInt(totalVisits)    || 0;
    const pv = parseInt(previousVisits) || 0;
    finalConsult = Array(12).fill(0).map((_, i) =>
      Math.max(0, Math.round(tv / 12) + Math.round(Math.sin(i) * 2)));
    finalCheckup = Array(12).fill(0).map((_, i) =>
      Math.max(0, Math.round(pv / 12) + Math.round(Math.cos(i) * 1)));
  }

  const avgMonthly = finalConsult.reduce((a, b) => a + b, 0) / 12;

  return {
    name, bpm, symptoms, totalVisits, previousVisits,
    ...grades,
    avgMonthlyLabel: `${avgMonthly.toFixed(1)} visits/mo`,
    consultData: finalConsult,
    checkupData: finalCheckup,
    chartHighlight: 4,
    appointments,
    visits,
    rawNotes: v("#formNotes") || "",
  };
}

/* ── Validation ── */
function validateForm() {
  const name     = $("#formName")?.value?.trim();
  const symptoms = $("#formSymptoms")?.value?.trim();
  const total    = $("#formTotalVisits")?.value?.trim();
  if (!name) {
    showToast("Please enter your full name.", "error");
    $("#formName")?.focus(); return false;
  }
  if (!symptoms || symptoms.length < 10) {
    showToast("Please describe your symptoms (at least 10 characters).", "error");
    $("#formSymptoms")?.focus(); return false;
  }
  if (!total || isNaN(parseInt(total))) {
    showToast("Please enter your current visit count.", "error");
    $("#formTotalVisits")?.focus(); return false;
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

  fetch("/api/health-data", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(formData),
  })
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(resp => ({ ...formData, ...resp }))
  .catch(() => formData)
  .then(merged => {
    renderDashboard(merged);
    state.healthData = merged;
    try { sessionStorage.setItem("medihealth_health_data", JSON.stringify(merged)); } catch(ex) {}

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
          sessionStorage.setItem("medihealth_report",    reportHTML);
          sessionStorage.setItem("medihealth_report_ts", new Date().toISOString());
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
async function runAgentAnalysis(data) {
  const systemPrompt = `You are MediAgent, a professional AI health analyst.
Analyse the patient's health data thoroughly and produce a structured analysis with these EXACT sections:
1. OVERALL HEALTH SCORE (0-100)
2. CARDIOVASCULAR ASSESSMENT
3. MEDICATION ADHERENCE REVIEW
4. MENTAL HEALTH ASSESSMENT
5. APPOINTMENT OVERVIEW
6. KEY RISK FACTORS
7. PERSONALISED RECOMMENDATIONS (at least 5 actionable points)
8. FOLLOW-UP ACTIONS
Be specific, reference the actual values provided. Use a professional but empathetic tone.
Always end with: "This report is AI-generated. Consult a qualified healthcare professional."`;

  const userMsg = `Please analyse the following patient health data and generate a full medical report:
Patient Name: ${data.name}
Resting Heart Rate: ${data.bpm ?? "Not provided"} BPM
Symptoms: ${data.symptoms || "None reported"}
Current Period Visits: ${data.totalVisits || 0}
Previous Period Visits: ${data.previousVisits || 0}
Computed Vitals Grade: ${data.vitalsGrade} (Symptom Score: ${data.symScore}, Visit Score: ${data.visitScore}, BPM Score: ${data.bpmScore})
Medication Adherence Grade: ${data.medGrade}
Mental Health Grade: ${data.mentalGrade}
Composite Health Score: ${data.compositeScore}/100
Appointments: ${JSON.stringify(data.appointments)}
Latest Visits: ${JSON.stringify(data.visits)}
Notes: ${data.rawNotes || "None"}`;

  const resp = await fetch("/chat", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ message: userMsg, history: [], system: systemPrompt }),
  });
  if (!resp.ok) throw new Error("Agent unavailable");
  const json = await resp.json();
  return json.response || "";
}
function showReportAlert(name) {
  const existing = $("#reportAlert");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.id = "reportAlert"; el.className = "report-alert";
  el.setAttribute("role","alert");
  el.innerHTML = `
    <div class="report-alert-icon"><i class="fa-solid fa-circle-check"></i></div>
    <div class="report-alert-body">
      <strong>
        <i class="fa-solid fa-robot" style="color:var(--green);font-size:11px;margin-right:3px"></i>
        Report Ready, ${name}!
      </strong>
      <span>Your MediAgent health report has been generated. Download Your Report Now.</span>
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
function downloadReport() {
  const data = state.healthData;
  if (!data) { showToast("Please fill in your health data first.", "error"); return; }
  fetch("/api/download-report", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  })
  .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
  .then(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href = url; a.download = `${data.name}_health_report.pdf`;
    a.click(); URL.revokeObjectURL(url);
    showToast("Report downloaded!", "success");
  })
  .catch(() => {
    const stored = sessionStorage.getItem("medihealth_report");
    if (stored) {
      window.open(URL.createObjectURL(new Blob([stored], { type: "text/html" })), "_blank");
      showToast("Report opened — use Print → Save as PDF", "success");
    } else {
      generateBasicHTMLReport(data);
    }
  });
}

function generateBasicHTMLReport(data) {
  const now       = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  const apptRows  = (data.appointments||[]).map(a =>
    `<tr><td>${a.id}</td><td>${a.dr}</td><td>${a.date}</td><td>${a.time}</td><td>${a.status}</td></tr>`
  ).join("") || "<tr><td colspan='5'>No appointments</td></tr>";
  const visitRows = (data.visits||[]).map(v =>
    `<tr><td>${v.name}</td><td>${v.spec}</td><td>${v.time||v.date||"—"}</td></tr>`
  ).join("") || "<tr><td colspan='3'>No visits</td></tr>";
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Health Report – ${data.name}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;background:#fff;color:#111;padding:40px;max-width:800px;margin:auto}
h1{font-size:26px;font-weight:800;margin-bottom:4px}.green{color:#1db87a}
.sec{margin-bottom:28px}.sec h2{font-size:14px;font-weight:700;border-bottom:2px solid #e8edf5;padding-bottom:6px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;font-size:10px;font-weight:700;color:#9ca3af;padding:7px 10px;border-bottom:1px solid #e8edf5}
td{padding:8px 10px;border-bottom:1px solid #f4f7fc}footer{margin-top:32px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e8edf5;padding-top:12px}
@media print{body{padding:20px}}</style></head><body>
<h1>Medi<span class="green">Health</span> Report</h1>
<p style="color:#6b7280;font-size:13px;margin-bottom:28px">Report for <strong>${data.name}</strong> &nbsp;·&nbsp; ${now}</p>
<div class="sec"><h2>Health Score</h2><p>Composite: <strong>${data.compositeScore||"—"}/100</strong></p></div>
<div class="sec"><h2>Grades</h2><p>Vitals: ${data.vitalsGrade} | Medication: ${data.medGrade} | Mental: ${data.mentalGrade}</p></div>
<div class="sec"><h2>Appointments</h2><table><thead><tr><th>ID</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>${apptRows}</tbody></table></div>
<div class="sec"><h2>Visits</h2><table><thead><tr><th>Doctor</th><th>Speciality</th><th>Date</th></tr></thead><tbody>${visitRows}</tbody></table></div>
<footer>MediHealth &nbsp;·&nbsp; For informational purposes only. Always consult your doctor.</footer>
<script>window.print();<\/script></body></html>`;
  window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
  showToast("Report opened — use Print → Save as PDF", "success");
}

function buildReportHTML(data, agentAnalysis) {
  const now  = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  const time = new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });
  const apptRows = (data.appointments||[]).map(a =>
    `<tr><td>${a.id}</td><td>${a.dr}</td><td>${a.date}</td><td>${a.time}</td>
     <td><span class="status-badge ${a.status}">${a.status}</span></td></tr>`
  ).join("") || "<tr><td colspan='5' class='empty'>No appointments recorded</td></tr>";
  const visitRows = (data.visits||[]).map(v =>
    `<tr><td>${v.name}</td><td>${v.spec}</td><td>${v.time||v.date||"—"}</td></tr>`
  ).join("") || "<tr><td colspan='3' class='empty'>No visits recorded</td></tr>";
  const analysisHTML = agentAnalysis
    ? agentAnalysis.split("\n").map(line => {
        if (/^\d+\./.test(line.trim())) return `<h3 class="analysis-section">${line.trim()}</h3>`;
        if (line.trim().startsWith("-") || line.trim().startsWith("•"))
          return `<li>${line.replace(/^[-•]\s*/,"").trim()}</li>`;
        return line.trim() ? `<p>${line.trim()}</p>` : "";
      }).join("\n").replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul>${m}</ul>`)
    : "<p>No agent analysis available.</p>";
  const bpmColor = (data.bpm||0)>100?"#e04040":(data.bpm||0)<50?"#f5a623":"#1db87a";
  const bpmLabel = (data.bpm||0)>100?"High":(data.bpm||0)<50?"Low":"Normal";
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Health Report — ${data.name}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#f4f7fc;color:#111827}
.report-page{max-width:860px;margin:0 auto;padding:40px 24px 80px}
.rpt-header{background:#fff;border-radius:20px;padding:28px 32px;margin-bottom:24px;border:1px solid #e8edf5;display:flex;align-items:center;justify-content:space-between;gap:20px}
.brand-icon{width:44px;height:44px;background:#1db87a;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px}
.brand-name{font-family:'Sora',sans-serif;font-size:20px;font-weight:700}.brand-name span{color:#1db87a}
.rpt-meta{text-align:right}.rpt-meta h2{font-family:'Sora',sans-serif;font-size:17px;font-weight:700;margin-bottom:4px}.rpt-meta p{font-size:12px;color:#9ca3af}
.score-banner{background:#eafff5;border:1px solid #c8f0e0;border-radius:20px;padding:24px 32px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.score-circle{width:72px;height:72px;border-radius:50%;background:#fff;border:3px solid #1db87a;display:flex;align-items:center;justify-content:center;flex-direction:column}
.score-num{font-family:'Sora',sans-serif;font-size:22px;font-weight:800;color:#1db87a;line-height:1}
.score-lbl{font-size:9px;color:#6b7280;text-transform:uppercase}
.score-stats{display:flex;gap:16px}
.score-stat{text-align:center;background:rgba(255,255,255,.7);border-radius:12px;padding:10px 16px;border:1px solid #c8f0e0}
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
.analysis-wrap h3{font-family:'Sora',sans-serif;font-size:13px;font-weight:700;background:#f4f7fc;padding:8px 12px;border-radius:8px;margin:16px 0 8px;border-left:3px solid #1db87a}
.analysis-wrap p{margin-bottom:8px}.analysis-wrap ul{padding-left:20px;margin-bottom:10px}.analysis-wrap li{margin-bottom:4px}
.charts-section{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px}
.chart-box{background:#fff;border-radius:16px;padding:18px;border:1px solid #e8edf5}
.chart-box h3{font-family:'Sora',sans-serif;font-size:13px;font-weight:700;margin-bottom:4px;color:#111827}
.chart-sub{font-size:11px;color:#9ca3af;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;padding:8px 10px;border-bottom:1px solid #e8edf5}
td{padding:10px;border-bottom:1px solid #f4f7fc;color:#374151}
.status-badge{font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;text-transform:capitalize}
.status-badge.confirmed{background:#e8faf3;color:#1db87a}.status-badge.pending{background:#fff3e0;color:#e07b00}.status-badge.cancelled{background:#fff0f0;color:#e04040}
td.empty{color:#9ca3af;font-style:italic;text-align:center;padding:16px}
.disclaimer{background:#fff3e0;border:1px solid #fed7aa;border-radius:10px;padding:12px 16px;margin-top:16px;font-size:12px;color:#92400e;display:flex;align-items:center;gap:8px}
.print-btn{display:inline-flex;align-items:center;gap:8px;margin-top:20px;background:#1db87a;color:#fff;border:none;border-radius:10px;padding:11px 22px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer}
.rpt-footer{text-align:center;font-size:11px;color:#9ca3af;margin-top:32px;padding-top:20px;border-top:1px solid #e8edf5}
.chart-legend-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font-size:11px;color:#6b7280}
.chart-legend-row span{display:flex;align-items:center;gap:4px}
.chart-legend-row i{width:10px;height:10px;border-radius:2px;display:inline-block}
@media print{body{background:#fff}.report-page{padding:20px}.print-btn{display:none}}
</style>
</head>
<body>
<div class="report-page">
  <div class="rpt-header">
    <div style="display:flex;align-items:center;gap:12px">
      <div class="brand-icon"><i class="fa-solid fa-heart-pulse"></i></div>
      <div><div class="brand-name">Medi<span>Health</span></div><div style="font-size:11px;color:#9ca3af">AI Health Report</div></div>
    </div>
    <div class="rpt-meta"><h2>${data.name}</h2><p>Generated ${now} at ${time}</p><p style="margin-top:3px;color:#1db87a;font-weight:600;font-size:11px">Analysed by MediAgent AI</p></div>
  </div>
  <div class="score-banner">
    <div style="display:flex;align-items:center;gap:16px">
      <div class="score-circle"><div class="score-num">${data.compositeScore||78}</div><div class="score-lbl">Health</div></div>
      <div>
        <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:700;margin-bottom:4px">Overall Health Score</div>
        <div style="font-size:13px;color:#6b7280">Symptom: ${data.symScore||"—"} &nbsp;·&nbsp; Visits: ${data.visitScore||"—"} &nbsp;·&nbsp; BPM: ${data.bpmScore||"—"}</div>
      </div>
    </div>
    <div class="score-stats">
      <div class="score-stat"><div class="val" style="color:${bpmColor}">${data.bpm||"—"}</div><div class="lbl">BPM · ${bpmLabel}</div></div>
      <div class="score-stat"><div class="val" style="color:#1db87a">${data.totalVisits||0}</div><div class="lbl">Current Visits</div></div>
      <div class="score-stat"><div class="val" style="color:#3a86ff">${data.previousVisits||0}</div><div class="lbl">Prev Visits</div></div>
    </div>
  </div>
  <div class="grades-row">
    <div class="grade-card"><div class="gc-cat">Vitals</div><div class="gc-val ${(data.vitalsGrade||"C")[0].toLowerCase()}">${data.vitalsGrade}</div></div>
    <div class="grade-card"><div class="gc-cat">Medication</div><div class="gc-val ${(data.medGrade||"C")[0].toLowerCase()}">${data.medGrade}</div></div>
    <div class="grade-card"><div class="gc-cat">Mental Health</div><div class="gc-val ${(data.mentalGrade||"C")[0].toLowerCase()}">${data.mentalGrade}</div></div>
  </div>
  ${data.visits && data.visits.length > 0 ? `
  <div class="charts-section">
    <div class="chart-box">
      <h3>Visits by month</h3><p class="chart-sub">Based on visit dates entered</p>
      <div style="position:relative;height:180px"><canvas id="rptBarChart" role="img" aria-label="Monthly visits bar chart"></canvas></div>
    </div>
    <div class="chart-box">
      <h3>Visits by speciality</h3><p class="chart-sub">Based on visit specialities entered</p>
      <div style="position:relative;height:180px"><canvas id="rptPieChart" role="img" aria-label="Visits by speciality pie chart"></canvas></div>
      <div class="chart-legend-row" id="rptPieLegend"></div>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>
  <script>
  (function(){
    const visits = ${JSON.stringify(data.visits)};
    const COLORS = ["#1db87a","#3a86ff","#f5a623","#7c3aed","#e04040","#0d9488","#f472b6"];
    /* Bar: monthly counts */
    const monthly = Array(12).fill(0);
    visits.forEach(v => {
      const d = new Date(v.date || v.time || "");
      if (!isNaN(d.getTime())) monthly[d.getMonth()]++;
    });
    new Chart(document.getElementById("rptBarChart"),{
      type:"bar",
      data:{labels:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
        datasets:[{label:"Visits",data:monthly,backgroundColor:"#1db87a",borderRadius:4}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{x:{ticks:{font:{size:9},autoSkip:false,maxRotation:0},grid:{display:false}},
                y:{beginAtZero:true,ticks:{font:{size:9},stepSize:1},grid:{color:"rgba(0,0,0,0.06)"}}}}
    });
    /* Pie: by speciality */
    const specMap = {};
    visits.forEach(v => {
      const k = (v.spec && v.spec !== "—") ? v.spec : "General";
      specMap[k] = (specMap[k]||0) + 1;
    });
    const specLabels = Object.keys(specMap);
    const specData   = Object.values(specMap);
    const total = specData.reduce((a,b)=>a+b,0);
    new Chart(document.getElementById("rptPieChart"),{
      type:"pie",
      data:{labels:specLabels,datasets:[{data:specData,backgroundColor:COLORS.slice(0,specLabels.length),borderWidth:2,borderColor:"#fff"}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}
    });
    const leg = document.getElementById("rptPieLegend");
    if(leg) leg.innerHTML = specLabels.map((l,i)=>
      '<span><i style="background:'+COLORS[i]+'"></i>'+l+' ('+Math.round(specData[i]/total*100)+'%)</span>'
    ).join("");
  })();
  <\/script>` : ""}
  <div class="section-card">
    <h2><i class="fa-solid fa-robot" style="color:#1db87a;margin-right:6px"></i>MediAgent Full Analysis</h2>
    <div class="analysis-wrap">${analysisHTML}</div>
  </div>
  <div class="section-card">
    <h2><i class="fa-solid fa-calendar-days" style="color:#1db87a;margin-right:6px"></i>Appointments</h2>
    <table><thead><tr><th>ID</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>${apptRows}</tbody></table>
  </div>
  <div class="section-card">
    <h2><i class="fa-solid fa-stethoscope" style="color:#1db87a;margin-right:6px"></i>Recent Visits</h2>
    <table><thead><tr><th>Doctor</th><th>Speciality</th><th>Date/Time</th></tr></thead><tbody>${visitRows}</tbody></table>
  </div>
  ${data.rawNotes ? `<div class="section-card"><h2>Patient Notes</h2><p style="font-size:14px;color:#4b5563;line-height:1.7">${data.rawNotes}</p></div>` : ""}
  <div class="disclaimer"><i class="fa-solid fa-triangle-exclamation"></i>This report is generated by MediAgent AI and is for informational purposes only. Always consult a qualified healthcare professional for medical decisions.</div>
  <button class="print-btn" onclick="window.print()"><i class="fa-solid fa-print"></i> Print / Save as PDF</button>
  <div class="rpt-footer">MediHealth &nbsp;·&nbsp; Report ID: MH-${Date.now().toString(36).toUpperCase()} &nbsp;·&nbsp; ${now}</div>
</div>
</body></html>`;
}
function toggleAgent() { $("#agentPanel").classList.toggle("open"); }

function sendAgentMessage() {
  const input = $("#agentInput");
  const msg   = input.value.trim();
  if (!msg) return;
  const body       = $("#agentBody");
  const userBubble = document.createElement("div");
  userBubble.className   = "agent-user-msg";
  userBubble.textContent = msg;
  body.appendChild(userBubble);
  input.value = "";
  body.scrollTop = body.scrollHeight;

  const systemCtx = state.healthData
    ? `You are MediAgent, a health assistant. Patient: ${state.healthData.name}, BPM: ${state.healthData.bpm}, Symptoms: ${state.healthData.symptoms}, Vitals: ${state.healthData.vitalsGrade}, Medication: ${state.healthData.medGrade}, Mental: ${state.healthData.mentalGrade}, Health Score: ${state.healthData.compositeScore}/100. Give concise, helpful health guidance. Always recommend consulting a doctor.`
    : "You are MediAgent, a friendly health assistant. Keep responses concise and always recommend consulting a qualified doctor.";

  fetch("/chat", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ message: msg, history: [], system: systemCtx }),
  })
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(d  => appendBotMsg(body, d.response || "I'm here to help!"))
  .catch(() => appendBotMsg(body, "Please consult your doctor for personalised advice."));
}

function appendBotMsg(container, text) {
  const resp = document.createElement("div");
  resp.className = "agent-bot-msg";
  resp.innerHTML = `<i class="fa-solid fa-robot"></i><span>${text}</span>`;
  container.appendChild(resp);
  container.scrollTop = container.scrollHeight;
}

function initTabs() {
  $$(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.chartTab = btn.textContent;
      if (state.healthData?.consultData) {
        drawBarChart(state.healthData.consultData, state.healthData.checkupData, state.healthData.chartHighlight);
      }
    });
  });
}
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
  initTabs();
  initHeartbeat(null);
  drawDonut(null);
  setTimeout(() => {
    drawBarChart(
      [38,52,61,45,70,55,66,48,72,50,68,80],
      [20,30,25,35,40,28,44,32,38,42,36,50],
      4
    );
  }, 100);
  try {
    const stored = sessionStorage.getItem("medihealth_health_data");
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