// AI Cognitive Guardian v3 — Popup Script

const BLOOM_COLORS = ["","#64748b","#2563eb","#16a34a","#ea580c","#7c3aed","#db2777"];

document.addEventListener("DOMContentLoaded", () => {
  loadAll();
  loadToggleState();
  initApiKeyUI();

  document.getElementById("guardian-toggle").addEventListener("change", (e) => {
    const active = e.target.checked;
    chrome.storage.local.set({ acg_active: active });
    document.getElementById("toggle-label").textContent = active ? "ON" : "OFF";
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    chrome.storage.local.set({
      acg_stats: { date: new Date().toDateString(), requests: 0, thinkFirst: 0, skipped: 0, essay: 0, streak: 1 },
      acg_total_xp: 0,
      acg_streak: 0,
    }, loadAll);
  });

  const exportBtn = document.getElementById("btn-export");
  if (exportBtn) exportBtn.addEventListener("click", exportHistory);

  loadHistory();
  const clearBtn = document.getElementById("history-clear-btn");
  if (clearBtn) clearBtn.addEventListener("click", () => {
    chrome.storage.local.remove(["acg_history"], loadHistory);
  });

  // Live refresh when extension updates storage
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.acg_stats)    renderStats(changes.acg_stats.newValue || {});
    if (changes.acg_total_xp || changes.acg_history) loadXP();
    if (changes.acg_history)  loadHistory();
  });
});

function loadAll() {
  loadStats();
  loadXP();
}

function loadToggleState() {
  chrome.storage.local.get(["acg_active"], (r) => {
    const active = r.acg_active !== false;
    document.getElementById("guardian-toggle").checked = active;
    document.getElementById("toggle-label").textContent = active ? "ON" : "OFF";
  });
}

function loadStats() {
  chrome.storage.local.get(["acg_stats"], (r) => {
    const today = new Date().toDateString();
    const s = (r.acg_stats?.date === today) ? r.acg_stats : {};
    renderStats(s);
  });
}

function renderStats(s) {
  const { requests=0, thinkFirst=0, skipped=0, essay=0, streak=0 } = s;

  setEl("stat-requests", requests);
  setEl("stat-guided",   thinkFirst);
  setEl("stat-essay",    essay);
  setEl("stat-tf",       thinkFirst);
  setEl("stat-streak",   streak + " 🔥");

  // Dependency score
  const total = requests || 1;
  const depScore = Math.round(Math.min(100, ((skipped/total)*70) + ((1-(thinkFirst/total))*30)));
  const scoreNum   = document.getElementById("score-num");
  const scoreBar   = document.getElementById("score-bar");
  const scoreBadge = document.getElementById("score-badge");
  if (scoreNum)   scoreNum.textContent   = depScore;
  if (scoreBar)   scoreBar.style.width   = depScore + "%";
  if (scoreBadge) {
    if (depScore < 30)       { scoreBadge.className = "score-badge badge-healthy";  scoreBadge.textContent = "Healthy"; }
    else if (depScore < 55)  { scoreBadge.className = "score-badge badge-moderate"; scoreBadge.textContent = "Moderate"; }
    else if (depScore < 75)  { scoreBadge.className = "score-badge badge-high";     scoreBadge.textContent = "High"; }
    else                     { scoreBadge.className = "score-badge badge-critical"; scoreBadge.textContent = "Critical"; }
  }
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── API Key UI ─────────────────────────────────────────────────────────────
function initApiKeyUI() {
  chrome.runtime.sendMessage({ type: "CHECK_API_KEY" }, (res) => {
    updateApiStatus(res && res.hasKey);
  });

  document.getElementById("api-toggle").addEventListener("click", () => {
    const row = document.getElementById("api-input-row");
    const btn = document.getElementById("api-toggle");
    const isOpen = row.style.display !== "none";
    row.style.display = isOpen ? "none" : "flex";
    btn.textContent = isOpen ? "Set key" : "Cancel";
  });

  document.getElementById("api-save-btn").addEventListener("click", () => {
    const key = document.getElementById("api-key-input").value.trim();
    if (!key) return;
    chrome.runtime.sendMessage({ type: "SAVE_API_KEY", key }, (res) => {
      if (res && res.ok) {
        updateApiStatus(true);
        document.getElementById("api-input-row").style.display = "none";
        document.getElementById("api-toggle").textContent = "Change";
        document.getElementById("api-key-input").value = "";
        // Auto-test after saving
        testApiConnection();
      }
    });
  });

  // Test button
  const testBtn = document.getElementById("api-test-btn");
  if (testBtn) testBtn.addEventListener("click", testApiConnection);
}

function testApiConnection() {
  const hintEl = document.getElementById("api-hint");
  if (hintEl) { hintEl.textContent = "⏳ Testing connection..."; hintEl.style.color = "#2563eb"; }
  chrome.runtime.sendMessage({ type: "TEST_API" }, (res) => {
    if (hintEl) {
      if (res && res.ok) {
        hintEl.textContent = "✅ API connected! Claude Haiku is ready.";
        hintEl.style.color = "#16a34a";
      } else {
        hintEl.textContent = "❌ Failed: " + (res?.error || "unknown error");
        hintEl.style.color = "#dc2626";
      }
    }
  });
}

function updateApiStatus(hasKey) {
  const statusEl = document.getElementById("api-status");
  const hintEl   = document.getElementById("api-hint");
  if (hasKey) {
    if (statusEl) { statusEl.textContent = "🟢 AI-powered"; statusEl.style.color = "#16a34a"; }
    if (hintEl)   hintEl.textContent = "✓ Auto framework + 6-level Bloom scoring";
    document.getElementById("api-toggle").textContent = "Change";
  } else {
    if (statusEl) { statusEl.textContent = "🔴 No API key"; statusEl.style.color = "#dc2626"; }
    if (hintEl)   hintEl.textContent = "Without key: uses rule-based questions";
  }
}

function exportHistory() {
  chrome.storage.local.get(["acg_history", "acg_stats", "acg_total_xp"], (r) => {
    const data = JSON.stringify({ history: r.acg_history||[], stats: r.acg_stats||{}, totalXP: r.acg_total_xp||0 }, null, 2);
    navigator.clipboard.writeText(data).then(() => {
      const btn = document.getElementById("btn-export");
      if (btn) { btn.textContent = "✓ Copied!"; setTimeout(() => { btn.textContent = "Export"; }, 2000); }
    });
  });
}

// ── XP + Thinking Level ────────────────────────────────────────────────────
const XP_LEVELS = [
  { name: "Remember",  min: 0,   max: 49,   color: "#64748b", bg: "#f1f5f9",  bar: "#94a3b8" },
  { name: "Understand",min: 50,  max: 149,  color: "#2563eb", bg: "#dbeafe",  bar: "#2563eb" },
  { name: "Apply",     min: 150, max: 299,  color: "#16a34a", bg: "#dcfce7",  bar: "#16a34a" },
  { name: "Analyze",   min: 300, max: 499,  color: "#ea580c", bg: "#ffedd5",  bar: "#ea580c" },
  { name: "Evaluate",  min: 500, max: 799,  color: "#7c3aed", bg: "#ede9fe",  bar: "#7c3aed" },
  { name: "Create",    min: 800, max: 99999,color: "#db2777", bg: "#fce7f3",  bar: "#db2777" },
];

function getLevel(xp) {
  return XP_LEVELS.find(l => xp >= l.min && xp <= l.max) || XP_LEVELS[0];
}

function loadXP() {
  chrome.storage.local.get(["acg_total_xp", "acg_history"], (r) => {
    renderXP(r.acg_total_xp || 0, r.acg_history || []);
  });
}

function renderXP(totalXP, history) {
  const level    = getLevel(totalXP);
  const idx      = XP_LEVELS.indexOf(level);
  const isMax    = idx === XP_LEVELS.length - 1;
  const next     = isMax ? null : XP_LEVELS[idx + 1];

  const xpInLvl  = totalXP - level.min;
  const xpNeeded = isMax ? 1 : (level.max - level.min + 1);
  const pct      = isMax ? 100 : Math.min(100, Math.round(xpInLvl / xpNeeded * 100));

  setEl("xp-level-name",  level.name);
  setEl("xp-total",       totalXP >= 1000 ? (totalXP/1000).toFixed(1)+"k" : String(totalXP));
  setEl("xp-bar-cur",     xpInLvl + " XP");
  setEl("xp-bar-next",    isMax ? "Max level" : "to " + next.name + ": " + (xpNeeded - xpInLvl) + " XP");

  const nameEl = document.getElementById("xp-level-name");
  if (nameEl) nameEl.style.color = level.color;

  const barEl = document.getElementById("xp-bar-fill");
  if (barEl) { barEl.style.width = pct + "%"; barEl.style.background = level.bar; }

  // Pip chips
  const pipsEl = document.getElementById("xp-levels-row");
  if (pipsEl) {
    pipsEl.innerHTML = XP_LEVELS.map((l, i) => {
      const active = i <= idx;
      return `<span class="xp-lvl-pip ${active ? "active" : ""}"
        style="background:${active ? l.bg : "#f1f5f9"};color:${active ? l.color : "#94a3b8"};border:1px solid ${active ? l.color+"55" : "#e2e8f0"}">${l.name}</span>`;
    }).join("");
  }

  // Update insight
  const insights = document.getElementById("insight-text");
  if (insights) {
    const bloomCounts = {};
    history.forEach(item => {
      if (item.bloomLevel && item.mode === "thinkfirst") {
        bloomCounts[item.bloomLevel] = (bloomCounts[item.bloomLevel] || 0) + 1;
      }
    });
    const top = Object.entries(bloomCounts).sort((a,b)=>b[1]-a[1])[0];
    const bloomNames = {1:"Remember",2:"Understand",3:"Apply",4:"Analyze",5:"Evaluate",6:"Create"};
    if (top) {
      insights.innerHTML = `Most frequent level: <strong>${bloomNames[top[0]]}</strong>. Keep answering to level up.`;
    }
  }
}

// ── History ────────────────────────────────────────────────────────────────
function loadHistory() {
  chrome.storage.local.get(["acg_history"], (r) => {
    const items = (r.acg_history || []).slice().reverse();
    const listEl = document.getElementById("history-list");
    if (!listEl) return;
    if (!items.length) {
      listEl.innerHTML = '<div class="history-empty">No sessions yet.<br>Complete a session to see it here.</div>';
      return;
    }
    listEl.innerHTML = items.map(renderHistoryCard).join("");
  });
}

function renderHistoryCard(item) {
  const bloomMap  = { 0:"essay", 1:"remember", 2:"understand", 3:"apply", 4:"analyze", 5:"evaluate", 6:"create" };
  const modeClass = item.mode === "essay" ? "essay" : "thinkfirst";
  const modeLabel = item.mode === "essay" ? "Essay" : "Think First";
  const bloomClass = bloomMap[item.bloomLevel] || "remember";
  const bloomLabel = item.bloomName || bloomClass.toUpperCase();
  const timeStr   = item.ts ? new Date(item.ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "";
  const xpBadge   = item.xpEarned ? `<span style="font-size:10px;font-weight:700;color:#b45309;background:#fef3c7;border:1px solid #fde68a;padding:1px 8px;border-radius:20px;margin-left:5px;">+${item.xpEarned} XP</span>` : "";
  const breakdown = item.xpBreakdown ? `<div style="font-size:10px;color:#94a3b8;margin-top:3px;">Q1 +${item.xpBreakdown.q1} · Q2 +${item.xpBreakdown.q2} · Q3 +${item.xpBreakdown.q3}${item.xpBreakdown.streak ? ` · streak +${item.xpBreakdown.streak}` : ""} (${item.xpBreakdown.answered}/3 answered)</div>` : "";

  return `<div class="history-card ${modeClass}">
    <div class="history-card-meta">
      <span class="history-card-mode ${modeClass}">${modeLabel}</span>
      <span class="history-card-time">${timeStr}</span>
    </div>
    <div class="history-card-prompt">${escHtml(item.prompt || "")}</div>
    <div class="history-card-answer">${escHtml(item.answer || "")}</div>
    <div class="history-card-footer">
      ${item.bloomLevel ? `<span class="history-card-bloom ${bloomClass}">${bloomLabel}</span>` : ""}
      ${xpBadge}
      ${breakdown}
      ${item.hint ? `<div style="font-size:10.5px;color:#3b6ee8;margin-top:5px;font-style:italic;border-left:2px solid #3b6ee8;padding-left:7px;">${escHtml(item.hint)}</div>` : ""}
    </div>
  </div>`;
}

function escHtml(s) {
  return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
