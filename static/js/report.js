const $ = id => document.getElementById(id);
function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "—";
}
function gradeColorClass(grade) {
  if (!grade) {
    return "";
  }
  const g = grade[0].toUpperCase();
  if (g === "A") {
    return "a";
  }
  if (g === "B") {
    return "b";
  }
  return "c";
}
function bpmColor(bpm) {
  if (!bpm) {
    return "#6b7280";
  }
  if (bpm > 100) {
    return "#e04040";
  }
  if (bpm < 50)  {
    return "#f5a623";
  }
  return "#1db87a";
}
function bpmLabel(bpm) {
  if (!bpm) {
    return "BPM";
  }
  if (bpm > 100) {
    return "BPM · High";
  }
  if (bpm < 50)  {
    return "BPM · Low";
  }
  return "BPM · Normal";
}
function formatDate() {
  return new Date().toLocaleDateString("en-US", { 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });
}
function formatTime() {
  return new Date().toLocaleTimeString("en-US", { 
    hour: "2-digit", 
    minute: "2-digit" 
  });
}
function populateMeta(data) {
  const now  = formatDate();
  const time = formatTime();
  setText("patientName",  data.name);
  setText("generatedAt",  `Generated ${now} at ${time}`);
  setText("footerDate",   now);
  setText("reportId",     `MH-${Date.now().toString(36).toUpperCase()}`);
  document.title = `Health Report — ${data.name}`;
}
function populateScoreBanner(data) {
  const bpmEl = $("bpmStatVal");
  if (bpmEl) {
    bpmEl.textContent  = data.bpm ?? "—";
    bpmEl.style.color  = bpmColor(data.bpm);
  }
  setText("bpmStatLabel",  bpmLabel(data.bpm));
  setText("vitalsStatVal", data.vitalsGrade);
  setText("medStatVal",    data.medGrade);
}
function populateGrades(data) {
  const grades = [
    { id: "gradeVitals", value: data.vitalsGrade },
    { id: "gradeMed",    value: data.medGrade     },
    { id: "gradeMental", value: data.mentalGrade  },
  ];
  grades.forEach(({ id, value }) => {
    const el = $(id);
    if (!el) return;
    el.textContent = value ?? "—";
    el.className   = `val ${gradeColorClass(value)}`;
  });
}
function populateAnalysis(agentText) {
  const wrap = $("analysisContent");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!agentText || !agentText.trim()) {
    const p = document.createElement("p");
    p.className   = "empty-text";
    p.textContent = "No agent analysis available.";
    wrap.appendChild(p);
    return;
  }
  const lines = agentText.split("\n");
  let  ulBuffer = null;
  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) {
      flushUl(wrap, ulBuffer);
      ulBuffer = null;
      return;
    }
    if (/^\d+\./.test(line)) {
      flushUl(wrap, ulBuffer);
      ulBuffer = null;
      const h3 = document.createElement("h3");
      h3.className   = "analysis-section";
      h3.textContent = line;
      wrap.appendChild(h3);
      return;
    }
    if (line.startsWith("-") || line.startsWith("•")) {
      if (!ulBuffer) {
        ulBuffer = document.createElement("ul");
      }
      const li = document.createElement("li");
      li.textContent = line.replace(/^[-•]\s*/, "");
      ulBuffer.appendChild(li);
      return;
    }
    flushUl(wrap, ulBuffer);
    ulBuffer = null;
    const p = document.createElement("p");
    p.textContent = line;
    wrap.appendChild(p);
  });
  flushUl(wrap, ulBuffer);
}
function flushUl(parent, ul) {
  if (ul && ul.childNodes.length) {
    parent.appendChild(ul);
  }
}
function populateAppointments(appointments) {
  const tbody = $("apptTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!appointments || !appointments.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan   = 5;
    td.className = "empty";
    td.textContent = "No appointments recorded";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  appointments.forEach(a => {
    const tr = document.createElement("tr");
    [a.id, a.dr, a.date, a.time].forEach(val => {
      const td = document.createElement("td");
      td.textContent = val ?? "—";
      tr.appendChild(td);
    });
    const tdStatus = document.createElement("td");
    const badge    = document.createElement("span");
    badge.className   = `status-badge ${a.status || "pending"}`;
    badge.textContent = a.status
      ? a.status[0].toUpperCase() + a.status.slice(1)
      : "Pending";
    tdStatus.appendChild(badge);
    tr.appendChild(tdStatus);
    tbody.appendChild(tr);
  });
}
function populateVisits(visits) {
  const tbody = $("visitsTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!visits || !visits.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan     = 3;
    td.className   = "empty";
    td.textContent = "No visits recorded";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  visits.forEach(v => {
    const tr = document.createElement("tr");
    [v.name, v.spec, v.time].forEach(val => {
      const td = document.createElement("td");
      td.textContent = val ?? "—";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}
function populateNotes(notes) {
  const card = $("notesCard");
  const text = $("notesText");
  if (!card || !text) {
    return;
  }
  if (notes && notes.trim()) {
    text.textContent = notes;
    card.classList.remove("hidden");
  } 
  else {
    card.classList.add("hidden");
  }
}
function showNoDataState() {
  const page = document.querySelector(".report-page");
  if (!page) {
    return;
  }
  page.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "no-data-state";
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-file-circle-xmark";
  const h2 = document.createElement("h2");
  h2.textContent = "No Report Data Found";
  const p = document.createElement("p");
  p.textContent = "Please go back to the dashboard and fill in your health data first.";
  const link = document.createElement("a");
  link.href      = "/dashboard";
  link.className = "back-link";
  link.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Back to Dashboard';
  wrap.appendChild(icon);
  wrap.appendChild(h2);
  wrap.appendChild(p);
  wrap.appendChild(link);
  page.appendChild(wrap);
}
document.addEventListener("DOMContentLoaded", () => {
  const rawReport  = sessionStorage.getItem("medihealth_report");
  const rawData    = sessionStorage.getItem("medihealth_health_data");
  const rawAnalysis= sessionStorage.getItem("medihealth_analysis");
  let data     = null;
  let analysis = null;
  if (rawData) {
    try { data = JSON.parse(rawData); } catch (_) {}
  }
  if (rawAnalysis) {
    analysis = rawAnalysis;
  }
  if (data) {
    populateMeta(data);
    populateScoreBanner(data);
    populateGrades(data);
    populateAnalysis(analysis);
    populateAppointments(data.appointments);
    populateVisits(data.visits);
    populateNotes(data.rawNotes);
    return;
  }
  showNoDataState();
});