const state = {
  user: { name: "User", avatarLetter: "U", bpm: null, bpmStatus: "—" },
  healthData: null,
  chartTab: "1year",
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ══════════════════════════════════
   TOAST
══════════════════════════════════ */
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

/* ══════════════════════════════════
   HEARTBEAT CANVAS
══════════════════════════════════ */
function initHeartbeat(bpmValue) {
  const canvas = $("#hbCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const base = [0,0,0,0,0,0,-18,30,-10,-28,20,6,0,0,0,0,0,0];
  let offset = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    const step = W / (base.length - 1);
    ctx.moveTo(0, H/2 + base[0]);
    for (let i = 1; i < base.length; i++) {
      ctx.lineTo(i * step, H/2 + base[(i + offset) % base.length]);
    }
    ctx.strokeStyle = "#1db87a";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();
    offset = (offset + 1) % base.length;
    setTimeout(() => requestAnimationFrame(draw), 80);
  }
  draw();
  if (bpmValue) {
    const bpmEl   = $("#bpmVal");
    const badgeEl = $("#bpmBadge");
    if (bpmEl) bpmEl.textContent = bpmValue;
    if (badgeEl) {
      const isHigh        = bpmValue > 100;
      badgeEl.textContent = isHigh ? "High" : "Normal";
      badgeEl.className   = `bpm-badge ${isHigh ? "high" : "normal"}`;
    }
  }
}

/* ══════════════════════════════════
   DONUT CHART
══════════════════════════════════ */
function drawDonut(data) {
  const canvas = $("#donutChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cx = canvas.width/2, cy = canvas.height/2, r = 44, thick = 14;
  const slices = data || [
    { val: 149, color: "#1db87a" },
    { val: 50,  color: "#3a86ff" },
    { val: 45,  color: "#f5a623" },
    { val: 506, color: "#edf2f7" },
  ];
  const total = slices.reduce((a,b) => a + b.val, 0);
  let start = -Math.PI / 2;
  slices.forEach(s => {
    const angle = (s.val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.strokeStyle = s.color;
    ctx.lineWidth   = thick;
    ctx.stroke();
    start += angle;
  });
}

/* ══════════════════════════════════
   BAR CHART
══════════════════════════════════ */
function drawBarChart(consultData, checkupData, highlightIdx) {
  const canvas = $("#barChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const months = consultData.length;
  const bgW    = W / months;
  const barW   = bgW * 0.28;
  const maxVal = Math.max(...consultData, ...checkupData, 1);
  consultData.forEach((v, i) => {
    const x    = i * bgW + bgW * 0.12;
    const bh   = (v / maxVal) * (H - 20);
    const isHL = i === (highlightIdx ?? -1);
    ctx.fillStyle = isHL ? "#1db87a" : "#e0f0e8";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, H - bh, barW, bh, 4);
    else               ctx.rect(x, H - bh, barW, bh);
    ctx.fill();
    const x2  = x + barW + 3;
    const bh2 = (checkupData[i] / maxVal) * (H - 20);
    ctx.fillStyle = isHL ? "#3a86ff" : "#dce8fb";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x2, H - bh2, barW, bh2, 4);
    else               ctx.rect(x2, H - bh2, barW, bh2);
    ctx.fill();
    if (isHL) {
      ctx.fillStyle  = "#1a1a1a";
      ctx.font       = "600 10px Sora";
      ctx.textAlign  = "center";
      ctx.fillText(`${v}`, x + barW, H - bh - 6);
    }
  });
}

/* ══════════════════════════════════
   RENDER DASHBOARD
   Immediately populates all widgets
   with the user-entered form data
══════════════════════════════════ */
function renderDashboard(data) {
  state.healthData = data;

  /* Name + avatar */
  ["#userName","#agentUserName"].forEach(sel => {
    const el = $(sel); if (el) el.textContent = data.name;
  });
  const av = $("#userAvatar");   if (av) av.textContent = data.name[0].toUpperCase();
  const an = $("#avatarName");   if (an) an.textContent = data.name;

  /* Heartbeat */
  initHeartbeat(data.bpm);

  /* Health summary grades */
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

  /* Overview avg */
  const avgEl = $("#ovAvgVal");
  if (avgEl && data.avgMonthlyLabel) avgEl.textContent = data.avgMonthlyLabel;

  /* Bar chart */
  if (data.consultData && data.checkupData) {
    drawBarChart(data.consultData, data.checkupData, data.chartHighlight ?? 4);
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
            <div class="visit-avatar ${colors[i % colors.length]}">${v.name[0]}</div>
            <div class="visit-info">
              <div class="visit-name">${v.name}</div>
              <div class="visit-spec">${v.spec}</div>
            </div>
            <div class="visit-time">${v.time}</div>
          </div>`).join("")
      : `<div class="empty-state">
           <i class="fa-regular fa-user-doctor"></i><span>No visits recorded</span>
         </div>`;
  }

  drawDonut();

  /* Enable Download button */
  const dlBtn = $("#downloadBtn");
  if (dlBtn) dlBtn.classList.remove("disabled");
}

/* ══════════════════════════════════
   MODAL OPEN / CLOSE
══════════════════════════════════ */
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
    <input type="text" placeholder="Time (e.g. 10:30 AM)" value="${data.time||''}" class="visit-time-input"/>
    <button class="btn-icon del" onclick="this.closest('.appt-row').remove()">
      <i class="fa-solid fa-minus"></i>
    </button>`;
  container.appendChild(row);
}

/* ══════════════════════════════════
   COLLECT FORM DATA
══════════════════════════════════ */
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

  const visits = $$(".appt-row", $("#visitContainer")).map(row => ({
    name: $(".visit-name-input", row)?.value?.trim() || "—",
    spec: $(".visit-spec-input", row)?.value?.trim() || "—",
    time: $(".visit-time-input", row)?.value?.trim() || "—",
  })).filter(vv => vv.name !== "—");

  const parseMonthly = raw => {
    const arr = (raw||"").split(",").map(x => parseFloat(x.trim())).filter(x => !isNaN(x));
    return arr.length === 12 ? arr : Array(12).fill(0);
  };

  const name        = v("#formName")   || "User";
  const bpm         = numOrNull("#formBpm");
  const vitalsGrade = v("#formVitals") || "A";
  const medGrade    = v("#formMed")    || "B+";
  const mentalGrade = v("#formMental") || "A";

  const gradeLabel = g => {
    if (g.startsWith("A")) return { pill: "good", note: "Excellent" };
    if (g.startsWith("B")) return { pill: "ok",   note: "Good" };
    return                        { pill: "warn",  note: "Needs Work" };
  };

  const consultData = parseMonthly(v("#consultData"));
  const checkupData = parseMonthly(v("#checkupData"));
  const avgMonthly  = consultData.reduce((a,b) => a+b, 0) / 12;

  return {
    name, bpm,
    vitalsGrade, ...gradeLabel(vitalsGrade), vitalsPill: gradeLabel(vitalsGrade).pill, vitalsNote: gradeLabel(vitalsGrade).note,
    medGrade,    ...gradeLabel(medGrade),    medPill:    gradeLabel(medGrade).pill,    medNote:    gradeLabel(medGrade).note,
    mentalGrade, ...gradeLabel(mentalGrade), mentalPill: gradeLabel(mentalGrade).pill, mentalNote: gradeLabel(mentalGrade).note,
    avgMonthlyLabel: `${avgMonthly.toFixed(0)} visits/mo`,
    consultData, checkupData, chartHighlight: 4,
    appointments, visits,
    rawNotes: v("#formNotes") || "",
  };
}

/* ══════════════════════════════════
   FORM SUBMIT
   Step 1 → save to FastAPI
   Step 2 → render dashboard NOW
   Step 3 → MediAgent analysis
   Step 4 → build + store report HTML
   Step 5 → show success alert
══════════════════════════════════ */
function handleFormSubmit(e) {
  e.preventDefault();

  const btn      = $("#formSubmitBtn");
  const progress = $("#agentProgress");
  const runAgent = $("#runAgentAnalysis")?.checked ?? true;

  btn.disabled  = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing…';
  if (progress) progress.classList.remove("hidden");

  const formData = collectFormData();

  /* Save to FastAPI; fall back to local data */
  fetch("/api/health-data", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(formData),
  })
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(resp => ({ ...formData, ...resp }))
  .catch(() => formData)
  .then(merged => {

    /* Render dashboard immediately with all entered data */
    renderDashboard(merged);
    state.healthData = merged;

    /* Persist so /reports page can use it */
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

/* ══════════════════════════════════
   MEDIAGENT — FastAPI /chat
══════════════════════════════════ */
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
Vitals Grade: ${data.vitalsGrade}
Medication Adherence: ${data.medGrade}
Mental Health Grade: ${data.mentalGrade}
Average Monthly Visits: ${data.avgMonthlyLabel}
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

/* ══════════════════════════════════
   SUCCESS ALERT — Bootstrap style
   Slides in from top-center
══════════════════════════════════ */
function showReportAlert(name) {
  const existing = $("#reportAlert");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id        = "reportAlert";
  el.className = "report-alert";
  el.setAttribute("role", "alert");
  el.innerHTML = `
    <div class="report-alert-icon">
      <i class="fa-solid fa-circle-check"></i>
    </div>
    <div class="report-alert-body">
      <strong>
        <i class="fa-solid fa-robot" style="color:var(--green);font-size:11px;margin-right:3px"></i>
        Report Ready, ${name}!
      </strong>
      <span>Your MediAgent health report has been generated. Check the Reports section.</span>
      <a href="/reports" class="report-alert-link">
        Go to Reports <i class="fa-solid fa-arrow-right"></i>
      </a>
    </div>
    <button class="report-alert-close" onclick="dismissReportAlert()" aria-label="Close">
      <i class="fa-solid fa-xmark"></i>
    </button>`;

  document.body.appendChild(el);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => el.classList.add("report-alert-visible"))
  );

  setTimeout(() => dismissReportAlert(), 12000);
}

function dismissReportAlert() {
  const el = $("#reportAlert");
  if (!el) return;
  el.classList.remove("report-alert-visible");
  setTimeout(() => el.remove(), 400);
}
window.dismissReportAlert = dismissReportAlert;

/* ══════════════════════════════════
   DOWNLOAD REPORT
══════════════════════════════════ */
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
  const now = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  const apptRows = (data.appointments||[]).map(a =>
    `<tr><td>${a.id}</td><td>${a.dr}</td><td>${a.date}</td><td>${a.time}</td><td>${a.status}</td></tr>`
  ).join("") || "<tr><td colspan='5'>No appointments</td></tr>";
  const visitRows = (data.visits||[]).map(v =>
    `<tr><td>${v.name}</td><td>${v.spec}</td><td>${v.time}</td></tr>`
  ).join("") || "<tr><td colspan='3'>No visits</td></tr>";
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Health Report – ${data.name}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;700;800&family=DM+Sans:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#fff;color:#111827;padding:40px;max-width:800px;margin:auto}
h1{font-family:'Sora',sans-serif;font-size:26px;font-weight:800;margin-bottom:4px}.green{color:#1db87a}.sub{color:#6b7280;font-size:13px;margin-bottom:28px}
.sec{margin-bottom:28px}.sec h2{font-family:'Sora',sans-serif;font-size:14px;font-weight:700;border-bottom:2px solid #e8edf5;padding-bottom:6px;margin-bottom:12px}
.grade-row{display:flex;gap:18px;flex-wrap:wrap}.grade-box{background:#f4f7fc;border-radius:10px;padding:12px 16px;flex:1;min-width:100px;text-align:center}
.grade-box .lbl{font-size:9px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:4px}
.grade-box .val{font-family:'Sora',sans-serif;font-size:28px;font-weight:800}
.val.a{color:#1db87a}.val.b{color:#3a86ff}.val.c{color:#f5a623}
table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;padding:7px 10px;border-bottom:1px solid #e8edf5}
td{padding:8px 10px;border-bottom:1px solid #f4f7fc;color:#374151}.bpm-big{font-family:'Sora',sans-serif;font-size:42px;font-weight:800;color:#1db87a}
.notes{background:#f4f7fc;border-radius:10px;padding:12px;font-size:12px;line-height:1.6}
footer{margin-top:32px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e8edf5;padding-top:12px}
@media print{body{padding:20px}}</style></head><body>
<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
  <div style="width:38px;height:38px;background:#1db87a;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px">&#10084;</div>
  <h1>Medi<span class="green">Health</span></h1>
</div>
<p class="sub">Report for <strong>${data.name}</strong> &nbsp;·&nbsp; ${now}</p>
<div class="sec"><h2>Heart Rate</h2>
  <div style="display:flex;align-items:center;gap:10px">
    <div class="bpm-big">${data.bpm||'—'}</div>
    <div><div style="font-size:12px;color:#6b7280">BPM</div>
    <div style="font-size:11px;font-weight:700;color:${(data.bpm||0)>100?'#e04040':'#1db87a'}">${(data.bpm||0)>100?'High':'Normal'}</div></div>
  </div>
</div>
<div class="sec"><h2>Health Summary</h2>
  <div class="grade-row">
    <div class="grade-box"><div class="lbl">Vitals</div><div class="val ${(data.vitalsGrade||'A')[0].toLowerCase()}">${data.vitalsGrade||'—'}</div></div>
    <div class="grade-box"><div class="lbl">Medication</div><div class="val ${(data.medGrade||'B')[0].toLowerCase()}">${data.medGrade||'—'}</div></div>
    <div class="grade-box"><div class="lbl">Mental Health</div><div class="val ${(data.mentalGrade||'A')[0].toLowerCase()}">${data.mentalGrade||'—'}</div></div>
  </div>
</div>
<div class="sec"><h2>Appointments</h2>
<table><thead><tr><th>ID</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>${apptRows}</tbody></table></div>
<div class="sec"><h2>Latest Visits</h2>
<table><thead><tr><th>Doctor</th><th>Speciality</th><th>Time</th></tr></thead><tbody>${visitRows}</tbody></table></div>
${data.rawNotes?`<div class="sec"><h2>Notes</h2><div class="notes">${data.rawNotes}</div></div>`:''}
<footer>MediHealth &nbsp;·&nbsp; For informational purposes only. Always consult your doctor.</footer>
<script>window.print();<\/script></body></html>`;
  window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
  showToast("Report opened — use Print → Save as PDF", "success");
}

/* ══════════════════════════════════
   BUILD FULL AGENT REPORT HTML
   Stored in sessionStorage
   Rendered at /reports
══════════════════════════════════ */
function buildReportHTML(data, agentAnalysis) {
  const now  = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  const time = new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });

  const apptRows = (data.appointments||[]).map(a =>
    `<tr><td>${a.id}</td><td>${a.dr}</td><td>${a.date}</td><td>${a.time}</td>
     <td><span class="status-badge ${a.status}">${a.status}</span></td></tr>`
  ).join("") || "<tr><td colspan='5' class='empty'>No appointments recorded</td></tr>";

  const visitRows = (data.visits||[]).map(v =>
    `<tr><td>${v.name}</td><td>${v.spec}</td><td>${v.time}</td></tr>`
  ).join("") || "<tr><td colspan='3' class='empty'>No visits recorded</td></tr>";

  const analysisHTML = agentAnalysis
    ? agentAnalysis
        .split("\n")
        .map(line => {
          if (/^\d+\./.test(line.trim()))
            return `<h3 class="analysis-section">${line.trim()}</h3>`;
          if (line.trim().startsWith("-") || line.trim().startsWith("•"))
            return `<li>${line.replace(/^[-•]\s*/, "").trim()}</li>`;
          return line.trim() ? `<p>${line.trim()}</p>` : "";
        })
        .join("\n")
        .replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul>${m}</ul>`)
    : "<p>No agent analysis available.</p>";

  const bpmColor = (data.bpm||0)>100?"#e04040":(data.bpm||0)<50?"#f5a623":"#1db87a";
  const bpmLabel = (data.bpm||0)>100?"High":(data.bpm||0)<50?"Low":"Normal";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Health Report — ${data.name}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:#f4f7fc;color:#111827;min-height:100vh}
.report-page{max-width:860px;margin:0 auto;padding:40px 24px 80px}
.rpt-header{background:#fff;border-radius:20px;padding:28px 32px;margin-bottom:24px;border:1px solid #e8edf5;box-shadow:0 2px 10px rgba(0,0,0,.06);display:flex;align-items:center;justify-content:space-between;gap:20px}
.rpt-brand{display:flex;align-items:center;gap:12px}
.brand-icon{width:44px;height:44px;background:linear-gradient(135deg,#1db87a,#0fa866);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;box-shadow:0 4px 12px rgba(29,184,122,.3)}
.brand-name{font-family:'Sora',sans-serif;font-size:20px;font-weight:700;color:#111827}
.brand-name span{color:#1db87a}
.rpt-meta{text-align:right}.rpt-meta h2{font-family:'Sora',sans-serif;font-size:17px;font-weight:700;margin-bottom:4px}
.rpt-meta p{font-size:12px;color:#9ca3af}
.score-banner{background:linear-gradient(135deg,#eafff5,#ddeeff);border:1px solid #c8f0e0;border-radius:20px;padding:24px 32px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.score-main{display:flex;align-items:center;gap:16px}
.score-circle{width:72px;height:72px;border-radius:50%;background:#fff;border:3px solid #1db87a;display:flex;align-items:center;justify-content:center;flex-direction:column;box-shadow:0 4px 14px rgba(29,184,122,.2)}
.score-num{font-family:'Sora',sans-serif;font-size:22px;font-weight:800;color:#1db87a;line-height:1}
.score-lbl{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px}
.score-text h3{font-family:'Sora',sans-serif;font-size:16px;font-weight:700;color:#111827;margin-bottom:4px}
.score-text p{font-size:13px;color:#6b7280}
.score-stats{display:flex;gap:16px}
.score-stat{text-align:center;background:rgba(255,255,255,.7);border-radius:12px;padding:10px 16px;border:1px solid #c8f0e0}
.score-stat .val{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;line-height:1;margin-bottom:2px}
.score-stat .lbl{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.4px}
.bpm-col{color:${bpmColor}}
.grades-row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px}
.grade-card{background:#fff;border-radius:16px;padding:18px;border:1px solid #e8edf5;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.05)}
.gc-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:15px;margin:0 auto 10px}
.gc-icon.g{background:#e8faf3;color:#1db87a}.gc-icon.b{background:#e8f0ff;color:#3a86ff}.gc-icon.p{background:#f0eeff;color:#7c3aed}
.gc-cat{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;margin-bottom:6px}
.gc-val{font-family:'Sora',sans-serif;font-size:28px;font-weight:800;line-height:1;margin-bottom:6px}
.gc-val.a{color:#1db87a}.gc-val.b{color:#3a86ff}.gc-val.c{color:#f5a623}
.gc-pill{display:inline-block;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.4px}
.gc-pill.good{background:#e8faf3;color:#1db87a}.gc-pill.ok{background:#e8f0ff;color:#3a86ff}.gc-pill.warn{background:#fff3e0;color:#e07b00}
.section-card{background:#fff;border-radius:16px;padding:22px 24px;margin-bottom:18px;border:1px solid #e8edf5;box-shadow:0 2px 8px rgba(0,0,0,.05)}
.section-card h2{font-family:'Sora',sans-serif;font-size:15px;font-weight:700;color:#111827;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.section-card h2 i{color:#1db87a;font-size:13px}
.section-card h2::after{content:'';flex:1;height:1px;background:#e8edf5;margin-left:8px}
.analysis-wrap{line-height:1.75;color:#374151;font-size:14px}
.analysis-wrap h3.analysis-section{font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#111827;background:#f4f7fc;padding:8px 12px;border-radius:8px;margin:16px 0 8px;border-left:3px solid #1db87a}
.analysis-wrap p{margin-bottom:8px}
.analysis-wrap ul{padding-left:20px;margin-bottom:10px}
.analysis-wrap li{margin-bottom:4px;color:#4b5563}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;padding:8px 10px;border-bottom:1px solid #e8edf5}
td{padding:10px;border-bottom:1px solid #f4f7fc;color:#374151}
tr:last-child td{border-bottom:none}tr:hover td{background:#fafbfc}
.status-badge{font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;text-transform:capitalize}
.status-badge.confirmed{background:#e8faf3;color:#1db87a}
.status-badge.pending{background:#fff3e0;color:#e07b00}
.status-badge.cancelled{background:#fff0f0;color:#e04040}
td.empty{color:#9ca3af;font-style:italic;text-align:center;padding:16px}
.disclaimer{background:#fff3e0;border:1px solid #fed7aa;border-radius:10px;padding:12px 16px;margin-top:16px;font-size:12px;color:#92400e;display:flex;align-items:center;gap:8px}
.disclaimer i{font-size:14px;flex-shrink:0}
.print-btn{display:inline-flex;align-items:center;gap:8px;margin-top:20px;background:#1db87a;color:#fff;border:none;border-radius:10px;padding:11px 22px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer}
.print-btn:hover{background:#0fa866}
.rpt-footer{text-align:center;font-size:11px;color:#9ca3af;margin-top:32px;padding-top:20px;border-top:1px solid #e8edf5}
@media print{body{background:#fff}.report-page{padding:20px}.print-btn{display:none}}
</style>
</head>
<body>
<div class="report-page">
  <div class="rpt-header">
    <div class="rpt-brand">
      <div class="brand-icon"><i class="fa-solid fa-heart-pulse"></i></div>
      <div><div class="brand-name">Medi<span>Health</span></div>
      <div style="font-size:11px;color:#9ca3af">AI Health Report</div></div>
    </div>
    <div class="rpt-meta">
      <h2>${data.name}</h2>
      <p>Generated ${now} at ${time}</p>
      <p style="margin-top:3px;color:#1db87a;font-weight:600;font-size:11px">Analysed by MediAgent AI</p>
    </div>
  </div>

  <div class="score-banner">
    <div class="score-main">
      <div class="score-circle">
        <div class="score-num">78</div>
        <div class="score-lbl">Health</div>
      </div>
      <div class="score-text">
        <h3>Overall Health Score</h3>
        <p>Based on vitals, medication, and mental health data</p>
      </div>
    </div>
    <div class="score-stats">
      <div class="score-stat">
        <div class="val bpm-col">${data.bpm||'—'}</div>
        <div class="lbl">BPM · ${bpmLabel}</div>
      </div>
      <div class="score-stat">
        <div class="val" style="color:#1db87a">${data.vitalsGrade}</div>
        <div class="lbl">Vitals</div>
      </div>
      <div class="score-stat">
        <div class="val" style="color:#3a86ff">${data.medGrade}</div>
        <div class="lbl">Medication</div>
      </div>
    </div>
  </div>

  <div class="grades-row">
    <div class="grade-card">
      <div class="gc-icon g"><i class="fa-solid fa-heart-pulse"></i></div>
      <div class="gc-cat">Vitals</div>
      <div class="gc-val ${data.vitalsGrade?.[0]?.toLowerCase()}">${data.vitalsGrade}</div>
      <div class="gc-pill good">This Week</div>
    </div>
    <div class="grade-card">
      <div class="gc-icon b"><i class="fa-solid fa-pills"></i></div>
      <div class="gc-cat">Medication</div>
      <div class="gc-val ${data.medGrade?.[0]?.toLowerCase()}">${data.medGrade}</div>
      <div class="gc-pill ok">Adherence</div>
    </div>
    <div class="grade-card">
      <div class="gc-icon p"><i class="fa-solid fa-brain"></i></div>
      <div class="gc-cat">Mental Health</div>
      <div class="gc-val ${data.mentalGrade?.[0]?.toLowerCase()}">${data.mentalGrade}</div>
      <div class="gc-pill good">Stability</div>
    </div>
  </div>

  <div class="section-card">
    <h2><i class="fa-solid fa-robot"></i> MediAgent Full Analysis</h2>
    <div class="analysis-wrap">${analysisHTML}</div>
  </div>

  <div class="section-card">
    <h2><i class="fa-solid fa-calendar-days"></i> Appointments</h2>
    <table><thead><tr><th>ID</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
    <tbody>${apptRows}</tbody></table>
  </div>

  <div class="section-card">
    <h2><i class="fa-solid fa-stethoscope"></i> Recent Visits</h2>
    <table><thead><tr><th>Doctor</th><th>Speciality</th><th>Time</th></tr></thead>
    <tbody>${visitRows}</tbody></table>
  </div>

  ${data.rawNotes?`
  <div class="section-card">
    <h2><i class="fa-solid fa-notes-medical"></i> Patient Notes</h2>
    <p style="font-size:14px;color:#4b5563;line-height:1.7">${data.rawNotes}</p>
  </div>`:""}

  <div class="disclaimer">
    <i class="fa-solid fa-triangle-exclamation"></i>
    This report is generated by MediAgent AI and is for informational purposes only.
    Always consult a qualified healthcare professional for medical decisions.
  </div>

  <button class="print-btn" onclick="window.print()">
    <i class="fa-solid fa-print"></i> Print / Save as PDF
  </button>

  <div class="rpt-footer">
    MediHealth &nbsp;·&nbsp; Report ID: MH-${Date.now().toString(36).toUpperCase()} &nbsp;·&nbsp; ${now}
  </div>
</div>
</body>
</html>`;
}

/* ══════════════════════════════════
   MEDIAGENT SIDE PANEL
══════════════════════════════════ */
function toggleAgent() { $("#agentPanel").classList.toggle("open"); }

function sendAgentMessage() {
  const input = $("#agentInput");
  const msg   = input.value.trim();
  if (!msg) return;
  const body         = $("#agentBody");
  const userBubble   = document.createElement("div");
  userBubble.className   = "agent-user-msg";
  userBubble.textContent = msg;
  body.appendChild(userBubble);
  input.value = "";
  body.scrollTop = body.scrollHeight;

  const systemCtx = state.healthData
    ? `You are MediAgent, a health assistant. Patient: ${state.healthData.name}, BPM: ${state.healthData.bpm}, Vitals: ${state.healthData.vitalsGrade}, Medication: ${state.healthData.medGrade}, Mental: ${state.healthData.mentalGrade}. Give concise, helpful health guidance. Always recommend consulting a doctor.`
    : "You are MediAgent, a friendly health assistant. Keep responses concise and always recommend consulting a qualified doctor.";

  fetch("/chat", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ message: msg, history: [], system: systemCtx }),
  })
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(d  => appendBotMsg(body, d.response || "I'm here to help!"))
  .catch(()  => appendBotMsg(body, "Please consult your doctor for personalised advice."));
}

function appendBotMsg(container, text) {
  const resp     = document.createElement("div");
  resp.className = "agent-bot-msg";
  resp.innerHTML = `<i class="fa-solid fa-robot"></i><span>${text}</span>`;
  container.appendChild(resp);
  container.scrollTop = container.scrollHeight;
}

/* ══════════════════════════════════
   TABS
══════════════════════════════════ */
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
  $("#agentInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter") sendAgentMessage();
  });

  initTabs();
  initHeartbeat(null);
  drawDonut();
  drawBarChart(
    [38,52,61,45,70,55,66,48,72,50,68,80],
    [20,30,25,35,40,28,44,32,38,42,36,50],
    4
  );

  const autoOpen = new URLSearchParams(window.location.search).get("openForm") === "1";
  if (autoOpen) setTimeout(() => openModal(), 100);
});
window.toggleAgent        = toggleAgent;
window.sendAgentMessage   = sendAgentMessage;
window.openModal          = openModal;
window.closeModal         = closeModal;
window.dismissReportAlert = dismissReportAlert;