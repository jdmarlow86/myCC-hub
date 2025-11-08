// Minimal single-prompt UI

const Api = {
  base: (window.API_BASE && window.API_BASE.trim()) || window.location.origin,
  async health(){
    const r = await fetch(`${this.base}/health`);
    return r.ok ? r.json() : Promise.reject(await r.text());
  },
  async agents(){
    const r = await fetch(`${this.base}/agents`);
    return r.ok ? r.json() : Promise.reject(await r.text());
  },
  async run(intent, goal){
    const r = await fetch(`${this.base}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent, goal })
    });
    return r.ok ? r.json() : Promise.reject(await r.json().catch(()=>({ error: "Request failed" })));
  }
};

const $ = (s)=>document.querySelector(s);

const runBtn=$("#runBtn"), clearBtn=$("#clearBtn"), goalInput=$("#goalInput");
const detectedLabel=$("#detectedLabel"), detectedCode=$("#detectedCode");
const result=$("#result");
const apiStatus=$("#apiStatus"), apiOriginLabel=$("#apiOriginLabel");

let AGENT_LABELS = {
  TA:"IT Agent", SA:"Sales Agent", PA:"Press Agent", FA:"Farming Agent", WA:"Wildlife Agent",
  CA:"Church Agent", JA:"Job Agent", ArA:"Arts Agent", RA:"Recreation Agent"
};

const INTENT_KEYWORDS = [
  { code:"PA", words:[ "press release", "press", "media", "newsroom", "announcement draft", "journalist" ] },
  { code:"JA", words:[ "resume", "cover letter", "job", "hiring", "interview", "career", "applicant", "application" ] },
  { code:"TA", words:[ "wifi", "wi‑fi", "printer", "computer", "laptop", "phone", "software", "bug", "error", "troubleshoot", "network", "router" ] },
  { code:"SA", words:[ "sales", "pitch", "outreach", "customers", "lead", "prospect", "marketing", "cta" ] },
  { code:"FA", words:[ "farm", "farming", "crop", "plant", "garden", "soil", "rotation", "fertilizer" ] },
  { code:"WA", words:[ "wildlife", "bear", "deer", "raccoon", "coyote", "snake", "animal control", "twra" ] },
  { code:"CA", words:[ "church", "vespers", "worship", "outreach", "ministry", "announcements", "sabbath", "service" ] },
  { code:"ArA", words:[ "art", "arts", "gallery", "exhibit", "craft", "showcase", "paint", "sculpt", "illustration" ] },
  { code:"RA", words:[ "hike", "trail", "camp", "recreation", "kayak", "picnic", "greenway", "overlook", "outdoors" ] }
];

function getUrlIntentOverride(){
  const u = new URL(window.location.href);
  const val = u.searchParams.get("intent");
  return val && AGENT_LABELS[val] ? val : null;
}

function detectIntent(goal){
  const m = goal.match(/^\s*([a-z]{2,3}|ara)\s*:\s*/i);
  if(m){
    const maybe = m[1].toUpperCase();
    if(AGENT_LABELS[maybe]) return maybe;
    if(maybe === "ARA") return "ArA";
  }

  const text = goal.toLowerCase();
  for(const {code, words} of INTENT_KEYWORDS){
    const sorted = [...words].sort((a,b)=>b.length - a.length);
    for(const w of sorted){
      if(w.includes(" ")){
        if(text.includes(w.toLowerCase())) return code;
      }else{
        const re = new RegExp(`\\b${escapeRegExp(w.toLowerCase())}\\b`);
        if(re.test(text)) return code;
      }
    }
  }
  return "TA";
}

function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function updateDetected(goal){
  const urlOverride = getUrlIntentOverride();
  const code = urlOverride || detectIntent(goal);
  detectedCode.textContent = `(${code})`;
  detectedLabel.textContent = AGENT_LABELS[code] || code;
  return code;
}

function setBusy(b){
  runBtn.disabled = b;
  const spin = runBtn.querySelector(".spinner");
  if(spin){ spin.classList.toggle("hidden", !b); }
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}

function showResultPretty(resp){
  if(!resp){ result.textContent = "No response yet."; return; }
  const { success, summary, data, receipt } = resp;
  let html = `<dl class="kv">
    <dt>Status</dt><dd>${success ? "✅ Success" : "❌ Failed"}</dd>
    <dt>Summary</dt><dd>${escapeHtml(summary || "")}</dd>
    <dt>Agent</dt><dd>${escapeHtml(receipt?.agent_label || detectedLabel.textContent)}</dd>
    <dt>Goal</dt><dd>${escapeHtml(receipt?.user_goal || goalInput.value)}</dd>
  </dl>`;

  if(data){
    if(Array.isArray(data.checklist)){
      html += `<h3>Checklist</h3><ul class="clean">${data.checklist.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
    }
    if(data.pitch){
      html += `<h3>Sales Pitch</h3><div><strong>${escapeHtml(data.pitch.headline || "")}</strong></div>${
        Array.isArray(data.pitch.value_props) ? `<ul class="clean">${data.pitch.value_props.map(p=>`<li>${escapeHtml(p)}</li>`).join("")}</ul>` : ""
      }${data.pitch.cta ? `<div><em>Call to action:</em> ${escapeHtml(data.pitch.cta)}</div>` : ""}`;
    }
    if(data.press_release){
      const pr=data.press_release;
      html += `<h3>Press Release</h3><div><strong>${escapeHtml(pr.title || "Community Update")}</strong></div><p>${escapeHtml(pr.lead || "")}</p>${
        Array.isArray(pr.bullet_points) ? `<ul class="clean">${pr.bullet_points.map(b=>`<li>${escapeHtml(b)}</li>`).join("")}</ul>` : ""
      }`;
    }
    if(data.plan){
      const p=data.plan;
      html += `<h3>Plan</h3>`;
      if(Array.isArray(p.crop_rotation)){
        html += `<div><strong>Crop rotation:</strong></div><ul class="clean">${p.crop_rotation.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
      }
      if(p.soil_test){ html += `<div><strong>Soil test:</strong> ${escapeHtml(p.soil_test)}</div>`; }
      if(p.goal_note){ html += `<div><strong>Note:</strong> ${escapeHtml(p.goal_note)}</div>`; }
    }
    if(data.guidance){
      const g=data.guidance;
      html += `<h3>Guidance</h3>`;
      if(Array.isArray(g.safety)){
        html += `<div><strong>Safety:</strong></div><ul class="clean">${g.safety.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
      }
      if(Array.isArray(g.contacts)){
        html += `<div><strong>Contacts:</strong></div><ul class="clean">${g.contacts.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
      }
      if(g.goal_note){ html += `<div><strong>Note:</strong> ${escapeHtml(g.goal_note)}</div>`; }
    }
    if(data.outline){
      const o=data.outline;
      html += `<h3>Announcements</h3>`;
      if(o.announcement){ html += `<div><strong>${escapeHtml(o.announcement)}</strong></div>`; }
      if(Array.isArray(o.schedule)){
        html += `<div><strong>Schedule:</strong></div><ul class="clean">${o.schedule.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
      }
      if(o.goal_note){ html += `<div><strong>Note:</strong> ${escapeHtml(o.goal_note)}</div>`; }
    }
    if(Array.isArray(data.steps)){
      html += `<h3>Next Steps</h3><ul class="clean">${data.steps.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
    }
    if(data.itinerary){
      const it=data.itinerary;
      html += `<h3>Itinerary</h3>`;
      if(Array.isArray(it.half_day)){
        html += `<div><strong>Half-day plan:</strong></div><ul class="clean">${it.half_day.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
      }
      if(Array.isArray(it.gear)){
        html += `<div><strong>Gear:</strong></div><ul class="clean">${it.gear.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
      }
      if(it.goal_note){ html += `<div><strong>Note:</strong> ${escapeHtml(it.goal_note)}</div>`; }
    }
  }

  result.innerHTML = html;
}

async function bootstrap(){
  apiOriginLabel.textContent = Api.base;
  apiOriginLabel.href = Api.base;

  try{
    await Api.health();
    apiStatus.textContent = "API Connected";
    apiStatus.classList.remove("status-chip--err", "status-chip--muted");
    apiStatus.classList.add("status-chip--ok");
  }catch{
    apiStatus.textContent = "API Unreachable";
    apiStatus.classList.remove("status-chip--ok", "status-chip--muted");
    apiStatus.classList.add("status-chip--err");
  }

  try{
    const list = await Api.agents();
    const map = {};
    for(const a of list){ map[a.code]=a.label; }
    if(map["ARA"] && !map["ArA"]){ map["ArA"]=map["ARA"]; delete map["ARA"]; }
    AGENT_LABELS = { ...AGENT_LABELS, ...map };
  }catch{
    // optional endpoint
  }

  updateDetected(goalInput.value || "");
  result.textContent = "Results will appear here.";
}

runBtn.addEventListener("click", async ()=>{
  const goal = goalInput.value.trim();
  if(!goal){
    goalInput.focus();
    goalInput.setAttribute("aria-invalid","true");
    return;
  }
  goalInput.removeAttribute("aria-invalid");

  const code = updateDetected(goal);
  setBusy(true);
  try{
    const resp = await Api.run(code, goal);
    showResultPretty(resp);
  }catch(e){
    showResultPretty({ success:false, summary:"Request failed", data:{ error: e?.error || "Unknown error" }, receipt:{ user_goal: goal } });
  }finally{
    setBusy(false);
  }
});

goalInput.addEventListener("input", ()=>{
  updateDetected(goalInput.value);
});

clearBtn.addEventListener("click", ()=>{
  goalInput.value = "";
  updateDetected("");
  result.textContent = "Results will appear here.";
  goalInput.focus();
});

bootstrap();
