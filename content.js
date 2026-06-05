// AI Cognitive Guardian v3
// New flow: detect prompt → show prerequisite framework → show questions from framework
//           → user answers → evaluate with full 6-level Bloom → inject enriched prompt

(function () {
  // ══════════════════════════════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════════════════════════════

  let guardianActive  = true;
  let overlayInjected = false;
  let thinkFirstDone  = false;
  let isSubmitting    = false;
  let isOurClick      = false;
  let aiAvailable     = false;

  let currentPrompt          = "";
  let currentMode            = "thinkfirst";
  let currentFramework       = null;
  let currentEvaluation      = null;
  let hintShown              = false;
  let currentHint            = "";
  let selectedBloomLevel     = 1;

  // Gamification state
  let sessionScore    = 0;
  let sessionStreak   = 0;
  let totalScore      = 0;

  // Bloom point values per level
  const BLOOM_POINTS = { 1: 10, 2: 20, 3: 35, 4: 55, 5: 80, 6: 100 };

  let overlayStep = "framework";

  // ── Bloom taxonomy (full 6 levels) ──────────────────────────────────────
  const BLOOM = {
    1: { name: "REMEMBER",   color: "#64748b", light: "#f1f5f9" },
    2: { name: "UNDERSTAND", color: "#2563eb", light: "#dbeafe" },
    3: { name: "APPLY",      color: "#16a34a", light: "#dcfce7" },
    4: { name: "ANALYZE",    color: "#ea580c", light: "#ffedd5" },
    5: { name: "EVALUATE",   color: "#7c3aed", light: "#ede9fe" },
    6: { name: "CREATE",     color: "#db2777", light: "#fce7f3" },
  };

  // ══════════════════════════════════════════════════════════════════════════
  // MODE DETECTION
  // ══════════════════════════════════════════════════════════════════════════

  const ESSAY_VERBS = ["viết","soạn","làm bài","hãy viết","giúp viết","viết dùm","soạn dùm","làm dùm","write","compose","draft","create a","generate","make me","help me write","write me","write a","craft"];
  const ESSAY_NOUNS = ["bài văn","đoạn văn","bài luận","thư","email","truyện","thơ","essay","paragraph","story","poem","letter","blog","article","caption","script","speech","cover letter"];
  const THINK_TRIGGERS = [
    // Vietnamese question words
    "tại sao","vì sao","làm sao","thế nào","là gì","nghĩa là","giải thích","phân tích",
    "so sánh","thông tin về","cho tôi biết","cho mình biết",
    // Vietnamese reason/cause triggers — previously missing
    "lý do","lí do","nguyên nhân","vì sao","do đâu","tại sao","ảnh hưởng","tác động",
    "liên quan","mối quan hệ","khác nhau","giống nhau","ưu điểm","nhược điểm",
    "cách","phương pháp","bước","quy trình","hướng dẫn","ý nghĩa","mục đích",
    "kết quả","hậu quả","lợi ích","tác hại","vai trò","chức năng","đặc điểm",
    // English
    "tell me","why","how does","how do","what is","what are","explain","analyze",
    "compare","describe","define","difference between","pros and cons",
    "help me understand","walk me through","reason","cause","impact","effect",
    "relationship between","how to","steps to","what happens","role of",
  ];
  const BYPASS_LIST   = ["hi","hello","hey","ok","okay","thanks","cảm ơn","xin chào","oke","okie","bye","tạm biệt","chào","haha","lol","nice","great","cool","yep","nope","sure","alright"];

  function containsAny(text, list) {
    const t = text.toLowerCase();
    return list.some(k => t.includes(k));
  }

  // Detect Vietnamese "là [X] gì" pattern (e.g. "là chòm sao gì", "là loại gì")
  function hasVietnameseQuestionPattern(text) {
    return /\blà\s+\S+(\s+\S+)?\s*gì\b/.test(text) ||
           /\bgì\s*\??\s*$/.test(text) ||
           /\bnhư thế nào\b/.test(text) ||
           /\bhoạt động (ra sao|như thế nào)\b/.test(text);
  }

  function detectMode(prompt) {
    const p = prompt.trim();
    const words = p.split(/\s+/).filter(w => w.length > 0);

    if (words.length < 2) return "bypass";
    if (/^[\d\s\+\-\*\/\=\(\)\[\]\.]+$/.test(p)) return "bypass";
    if (containsAny(p, BYPASS_LIST) && words.length <= 3) return "bypass";
    if (/^https?:\/\/|www\./.test(p)) return "bypass";
    if (/^(function|const|let|var|if|for|import|class|def|print|console)\b/.test(p)) return "bypass";

    const hasEssayVerb = containsAny(p, ESSAY_VERBS);
    const hasEssayNoun = containsAny(p, ESSAY_NOUNS);
    if (hasEssayVerb && hasEssayNoun) return "essay";
    if (hasEssayVerb && p.length > 15) return "essay";

    if (containsAny(p, THINK_TRIGGERS) || hasVietnameseQuestionPattern(p)) return "thinkfirst";
    if (p.length > 20) return "thinkfirst"; // any non-trivial statement triggers

    return "bypass";
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RULE-BASED FALLBACKS (when no API key)
  // ══════════════════════════════════════════════════════════════════════════

  function extractKeyword(text) {
    const fillers = new Set(["là","gì","cho","tôi","tui","bạn","hãy","và","của","với","được","này","khi","nào","về","một","các","có","không","tại","sao","vì","thế","làm","sao","thông","tin","giải","thích","why","how","what","who","when","where","tell","help","please","explain","write","create","define","describe","is","are","was","were","do","does","did","the","a","an","of","in","on","at","to","for","with","about","me","my","i"]);
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const meaningful = words.filter(w => !fillers.has(w));
    if (meaningful.length === 0) return text || "chủ đề này";
    for (let size = 3; size >= 2; size--) {
      for (let i = 0; i <= meaningful.length - size; i++) {
        const phrase = meaningful.slice(i, i + size).join(" ");
        if (text.toLowerCase().includes(phrase)) return phrase;
      }
    }
    return meaningful.sort((a, b) => b.length - a.length)[0] || "chủ đề này";
  }

  function fallbackFramework(prompt) {
    const keyword = extractKeyword(prompt);
    return {
      prerequisiteTopic: keyword,
      scaffold: [
        `Bạn đã từng tiếp xúc hoặc nghe về <strong>${keyword}</strong> trong cuộc sống hàng ngày chưa — đó chính là xuất phát điểm cần nắm.`,
        `<strong>${keyword}</strong> khác với các khái niệm liên quan ở chỗ nó có một phạm vi ứng dụng cụ thể — đừng nhầm lẫn với những thứ trông giống nhau.`,
        `Chỉ áp dụng <strong>${keyword}</strong> khi đủ điều kiện cần thiết; không dùng khi thiếu thông tin hoặc bối cảnh không phù hợp.`,
        `Vì vậy hiểu <strong>${keyword}</strong> giúp bạn trả lời câu hỏi của mình vì nó là nền tảng của khái niệm bạn đang hỏi.`,
      ],
      questions: [
        `Dựa vào ${keyword}, bạn đoán khái niệm bạn đang hỏi có liên quan đến điều gì cụ thể?`,
        `Nếu ${keyword} thay đổi, bạn nghĩ câu hỏi của bạn sẽ có câu trả lời khác không — tại sao?`,
        `Điều gì ở ${keyword} khiến bạn chưa rõ và muốn AI làm rõ thêm?`,
      ],
      hint: "Cứ viết suy nghĩ thật — không cần hoàn hảo.",
      targetBloomLevel: 1
    };
  }

  function fallbackEssayQuestions(prompt) {
    const keyword = extractKeyword(prompt);
    return {
      questions: [
        `Ý chính bạn muốn truyền đạt về "${keyword}" là gì?`,
        "Góc nhìn hoặc cảm xúc cá nhân bạn muốn đưa vào bài viết?",
        "Ví dụ hoặc kỷ niệm cụ thể nào bạn muốn nhắc đến?"
      ],
      hint: "Viết ra suy nghĩ thô của bạn — AI sẽ trau chuốt, không thay thế ý tưởng."
    };
  }

  // Simple rule-based bloom detection for fallback
  const REASONING_WORDS = ["vì","nên","nhưng","tuy nhiên","nếu","nguyên nhân","do đó","vì vậy","theo tôi","tôi nghĩ","dẫn đến","because","therefore","however","i think","i believe","which means","leads to","as a result","for example","this shows","compared to","the weakness","i would argue","i would design"];

  function fallbackEvaluate(userAnswer) {
    const lower     = userAnswer.toLowerCase();
    const wordCount = lower.trim().split(/\s+/).length;
    const reasoningCount = REASONING_WORDS.filter(w => lower.includes(w)).length;

    // Lenient: reward any genuine attempt generously
    let level = 1;
    if (wordCount < 4) {
      level = 1; // only 1-3 words → REMEMBER
    } else if (reasoningCount >= 2 && wordCount >= 25) {
      level = 4; // clear comparison/analysis
    } else if (reasoningCount >= 1 && wordCount >= 15) {
      level = 3; // has reasoning + decent length → APPLY
    } else if (wordCount >= 8) {
      level = 2; // typed a real sentence → UNDERSTAND
    }

    const nextLevel = Math.min(level + 1, 6);
    const NEXT_TIPS = {
      2: "Thêm một ví dụ cụ thể từ cuộc sống hoặc công việc của bạn.",
      3: "Thử so sánh với một phương pháp khác mà bạn biết.",
      4: "Đánh giá xem cách này có hạn chế gì trong thực tế không.",
      5: "Đề xuất cách bạn sẽ cải tiến hoặc ứng dụng khái niệm này.",
      6: "Tuyệt vời — bạn đang ở mức cao nhất rồi!",
    };

    return {
      detectedBloomLevel: level,
      bloomName: BLOOM[level].name,
      signals: [wordCount >= 8 ? "Câu trả lời có nội dung" : "Câu trả lời ngắn"],
      hint: NEXT_TIPS[nextLevel] || "Hãy thêm ví dụ cụ thể.",
      nextLevelQuestion: "Bạn có thể cho một ví dụ thực tế về điều này không?",
      strength: wordCount >= 8 ? "Bạn đã diễn đạt được ý của mình" : "Bạn đã bắt đầu suy nghĩ về vấn đề"
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // OVERLAY HTML
  // ══════════════════════════════════════════════════════════════════════════

  function injectOverlay() {
    if (overlayInjected) return;
    overlayInjected = true;

    const el = document.createElement("div");
    el.id = "acg-overlay";
    el.innerHTML = `
      <div id="acg-modal">

        <!-- HEADER -->
        <div id="acg-header">
          <div id="acg-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <line x1="12" y1="1" x2="12" y2="3.5" stroke="#0f2744" stroke-width="2" stroke-linecap="round"/>
              <line x1="19.07" y1="3.34" x2="17.48" y2="4.93" stroke="#0f2744" stroke-width="2" stroke-linecap="round"/>
              <line x1="22" y1="11" x2="19.5" y2="11" stroke="#0f2744" stroke-width="2" stroke-linecap="round"/>
              <line x1="4.93" y1="3.34" x2="6.52" y2="4.93" stroke="#0f2744" stroke-width="2" stroke-linecap="round"/>
              <line x1="2" y1="11" x2="4.5" y2="11" stroke="#0f2744" stroke-width="2" stroke-linecap="round"/>
              <path d="M9 21h6M10 18h4M8.5 14.5C7 13.3 6 11.76 6 10a6 6 0 1 1 12 0c0 1.76-1 3.3-2.5 4.5V16a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-1.5z" stroke="#0f2744" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
            <span class="acg-brand">AI Cognitive Guardian <span class="acg-v">v3</span></span>
          </div>
          <div id="acg-header-right">
            <div id="acg-prompt-preview">
              <span id="acg-prompt-text"></span>
            </div>

            <!-- Level dropdown -->
            <div id="acg-level-wrap">
              <button id="acg-level-btn" class="acg-level-btn">
                <span id="acg-level-label">Mới bắt đầu</span>
                <span class="acg-chevron">▾</span>
              </button>
              <div id="acg-level-dropdown">
                <div class="acg-dd-title">Mức độ kiến thức của bạn</div>
                <div class="acg-level-item" data-level="1">
                  <span class="acg-level-dot" style="background:#64748b"></span>
                  <div><div class="acg-level-name">Mới bắt đầu</div><div class="acg-level-desc">Chưa biết gì về chủ đề</div></div>
                </div>
                <div class="acg-level-item" data-level="2">
                  <span class="acg-level-dot" style="background:#2563eb"></span>
                  <div><div class="acg-level-name">Cơ bản</div><div class="acg-level-desc">Đã nghe qua, biết sơ sơ</div></div>
                </div>
                <div class="acg-level-item" data-level="3">
                  <span class="acg-level-dot" style="background:#16a34a"></span>
                  <div><div class="acg-level-name">Trung cấp</div><div class="acg-level-desc">Đã dùng hoặc học qua</div></div>
                </div>
                <div class="acg-level-item" data-level="4">
                  <span class="acg-level-dot" style="background:#ea580c"></span>
                  <div><div class="acg-level-name">Nâng cao</div><div class="acg-level-desc">Hiểu khá rõ, muốn đào sâu</div></div>
                </div>
                <div class="acg-level-item" data-level="5">
                  <span class="acg-level-dot" style="background:#7c3aed"></span>
                  <div><div class="acg-level-name">Chuyên sâu</div><div class="acg-level-desc">Có kinh nghiệm thực tế</div></div>
                </div>
                <div class="acg-level-item" data-level="6">
                  <span class="acg-level-dot" style="background:#db2777"></span>
                  <div><div class="acg-level-name">Chuyên gia</div><div class="acg-level-desc">Nắm vững, muốn thách thức</div></div>
                </div>
              </div>
            </div>

            <div id="acg-score-pill">
              <span class="acg-score-label">Dep.</span>
              <span id="acg-score-value">–</span>
            </div>
            <span id="acg-api-status-badge" style="font-size:11px;font-weight:600;"></span>
            <div id="acg-xp-pill">
              <span class="acg-xp-icon">★</span>
              <span id="acg-xp-value">0</span>
              <span class="acg-xp-label">XP</span>
            </div>
          </div>
        </div>

        <!-- TWO-COLUMN BODY -->
        <div id="acg-body">

          <!-- LEFT: Prerequisite Framework -->
          <div id="acg-col-left">
            <div class="acg-col-header">
              <span class="acg-col-tag acg-col-tag-blue">📚 Kiến thức nền</span>
              <span id="acg-prereq-topic-label"></span>
            </div>
            <ul id="acg-scaffold-list">
              <li class="acg-scaffold-loading">Đang phân tích kiến thức nền...</li>
            </ul>
          </div>

          <!-- DIVIDER -->
          <div id="acg-col-divider"></div>

          <!-- RIGHT: Questions + Answer -->
          <div id="acg-col-right">
            <div class="acg-col-header">
              <span class="acg-col-tag acg-col-tag-indigo">✏️ Câu hỏi cho bạn</span>
              <span id="acg-bloom-tag"></span>
            </div>

            <div id="acg-questions-list"></div>

            <textarea id="acg-attempt" rows="4"
              placeholder="Viết suy nghĩ của bạn vào đây... (Enter = nộp · Shift+Enter = xuống dòng)"></textarea>

            <div id="acg-hint-section" style="display:none;">
              <span class="acg-hint-label">💡</span>
              <span id="acg-hint-text"></span>
            </div>

            <div id="acg-bottom-row">
              <button id="acg-btn-hint" class="acg-btn-ghost-sm">💡 Hint</button>
              <span id="acg-char-hint">Nhập ít nhất 3 từ</span>
            </div>

            <div id="acg-actions">
              <button id="acg-btn-skip" class="acg-btn-ghost">Bỏ qua</button>
              <button id="acg-btn-submit" class="acg-btn-primary" disabled>Nộp bài →</button>
            </div>
            <div id="acg-enter-tip">Enter để nộp · Shift+Enter xuống dòng</div>
          </div>

        </div>

        <!-- FOOTER -->
        <div id="acg-footer">
          <div class="acg-stat"><span class="acg-stat-num" id="stat-requests">0</span><span class="acg-stat-desc">requests</span></div>
          <div class="acg-divider"></div>
          <div class="acg-stat"><span class="acg-stat-num" id="stat-guided">0</span><span class="acg-stat-desc">guided</span></div>
          <div class="acg-divider"></div>
          <div class="acg-stat"><span class="acg-stat-num" id="stat-skipped">0</span><span class="acg-stat-desc">skipped</span></div>
        </div>

      </div>
    `;
    document.body.appendChild(el);

    // Bind events
    document.getElementById("acg-btn-submit").addEventListener("click", onSubmit);
    document.getElementById("acg-btn-skip").addEventListener("click", onSkip);
    document.getElementById("acg-btn-hint").addEventListener("click", onToggleHint);
    document.getElementById("acg-attempt").addEventListener("input", onAttemptInput);
    document.getElementById("acg-attempt").addEventListener("keydown", onTextareaKeydown);

    // Level dropdown
    const levelBtn = document.getElementById("acg-level-btn");
    const levelDd  = document.getElementById("acg-level-dropdown");
    levelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      levelDd.classList.toggle("open");
    });
    document.querySelectorAll(".acg-level-item").forEach(item => {
      item.addEventListener("click", () => {
        const lvl = parseInt(item.dataset.level);
        selectedBloomLevel = lvl;
        chrome.storage.local.set({ acg_bloom_pref: lvl });
        levelDd.classList.remove("open");
        // Update button label + active highlight
        updateLevelBtn(lvl);
        // Regenerate framework at new level
        showFrameworkStep();
      });
    });
    document.addEventListener("click", () => levelDd.classList.remove("open"));

    makeDraggable(document.getElementById("acg-modal"), document.getElementById("acg-header"));
  }

  function updateLevelBtn(lvl) {
    const LEVEL_LABELS = { 1:"Mới bắt đầu", 2:"Cơ bản", 3:"Trung cấp", 4:"Nâng cao", 5:"Chuyên sâu", 6:"Chuyên gia" };
    const LEVEL_COLORS = { 1:"#64748b", 2:"#2563eb", 3:"#16a34a", 4:"#ea580c", 5:"#7c3aed", 6:"#db2777" };
    const labelEl = document.getElementById("acg-level-label");
    const btnEl   = document.getElementById("acg-level-btn");
    if (labelEl) labelEl.textContent = LEVEL_LABELS[lvl] || "Mới bắt đầu";
    if (btnEl)   btnEl.style.borderColor = LEVEL_COLORS[lvl] || "#e2e8f0";
    // Highlight active item
    document.querySelectorAll(".acg-level-item").forEach(item => {
      item.classList.toggle("active", parseInt(item.dataset.level) === lvl);
    });
  }

  function makeDraggable(modal, handle) {
    if (!modal || !handle) return;
    let isDragging = false, startX, startY, origX, origY;
    handle.addEventListener("mousedown", (e) => {
      isDragging = true;
      const rect = modal.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      origX = rect.left; origY = rect.top;
      modal.style.position = "fixed"; modal.style.margin = "0";
      modal.style.left = origX + "px"; modal.style.top = origY + "px";
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      modal.style.left = (origX + e.clientX - startX) + "px";
      modal.style.top  = (origY + e.clientY - startY) + "px";
    });
    document.addEventListener("mouseup", () => { isDragging = false; });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHOW OVERLAY — entry point
  // ══════════════════════════════════════════════════════════════════════════

  function showOverlay(promptText) {
    currentPrompt    = promptText;
    currentMode      = detectMode(promptText);
    currentFramework = null;
    currentEvaluation = null;
    hintShown        = false;

    injectOverlay();
    loadStats();
    updateLevelBtn(selectedBloomLevel);

    const previewEl = document.getElementById("acg-prompt-text");
    if (previewEl) previewEl.textContent = '"' + (promptText.length > 80 ? promptText.slice(0, 80) + "…" : promptText) + '"';

    if (currentMode === "essay") {
      showEssayStep();
      return;
    }

    // Load framework + questions simultaneously into their columns
    showFrameworkStep();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SINGLE-PANEL: load framework (left) + questions (right) together
  // ══════════════════════════════════════════════════════════════════════════

  function showFrameworkStep() {
    const scaffoldList  = document.getElementById("acg-scaffold-list");
    const prereqLabel   = document.getElementById("acg-prereq-topic-label");
    const questionsList = document.getElementById("acg-questions-list");
    const bloomTagEl    = document.getElementById("acg-bloom-tag");

    if (scaffoldList)  scaffoldList.innerHTML  = '<li class="acg-scaffold-loading">⏳ Đang gọi Groq API...</li>';
    if (prereqLabel)   prereqLabel.textContent  = "";
    if (questionsList) questionsList.innerHTML  = '<div class="acg-q-loading">Đang tạo câu hỏi...</div>';
    if (bloomTagEl)    bloomTagEl.innerHTML      = "";

    const overlay = document.getElementById("acg-overlay");
    if (overlay) overlay.classList.remove("acg-fade-out");

    // Show live status in header
    function setStatus(msg, color) {
      const el = document.getElementById("acg-api-status-badge");
      if (el) { el.textContent = msg; el.style.color = color; }
    }
    setStatus("⏳ calling API...", "#2563eb");

    const timeout = setTimeout(() => {
      setStatus("⏰ timeout — using fallback", "#ea580c");
      renderFramework(fallbackFramework(currentPrompt));
    }, 10000);

    chrome.runtime.sendMessage(
      { type: "GENERATE_FRAMEWORK", prompt: currentPrompt, bloomLevel: selectedBloomLevel },
      (res) => {
        clearTimeout(timeout);
        if (res && res.ok && res.data) {
          setStatus("✅ API OK", "#16a34a");
          renderFramework(res.data);
        } else {
          const err = res?.error || "no response";
          setStatus("❌ " + err, "#dc2626");
          // Show error in scaffold area
          if (scaffoldList) {
            scaffoldList.innerHTML = `<li style="list-style:none;padding:12px;background:#fee2e2;border-radius:10px;border-left:3px solid #dc2626;color:#dc2626;font-size:13px;">
              <strong>API Error:</strong> ${err}<br><br>
              ${err === "NO_API_KEY" ? "→ Mở popup extension → nhập Groq API key (gsk_...) → Save → Test" : "→ Kiểm tra key Groq tại console.groq.com"}
            </li>`;
            setTimeout(() => renderFramework(fallbackFramework(currentPrompt)), 3000);
          } else {
            renderFramework(fallbackFramework(currentPrompt));
          }
        }
      }
    );

    resetTextarea();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // KEYWORD EXTRACTION — smart auto-bold using TF-IDF-inspired approach
  // ══════════════════════════════════════════════════════════════════════════

  const STOPWORDS_VI = new Set([
    "là","và","của","có","trong","được","một","các","với","cho","không","này","đó","khi","nào",
    "về","theo","từ","như","thì","đã","sẽ","bạn","tôi","mình","họ","ta","chúng","nên","cần",
    "hãy","phải","hay","hoặc","nhưng","vì","nên","do","bởi","rằng","để","mà","thế","nếu",
    "dù","vẫn","cũng","đều","rất","quá","khá","hơn","nhất","lại","ra","vào","lên","xuống",
    "nhiều","ít","đây","kia","sau","trước","đến","tới","qua","lúc","ngay","chỉ","chính","thật",
    "tất","cả","mỗi","ai","gì","đâu","sao","thế","nào","bao","giờ","bao","nhiêu","tại","sao"
  ]);

  const STOPWORDS_EN = new Set([
    "the","a","an","of","in","on","at","to","for","with","about","and","or","but","is","are",
    "was","were","be","been","being","have","has","had","do","does","did","will","would","could",
    "should","may","might","must","can","this","that","these","those","it","its","they","their",
    "which","when","where","who","how","what","why","if","then","so","as","by","from","into",
    "not","no","yes","very","also","just","more","most","some","any","all","each","every","both"
  ]);

  function autoHighlightKeywords(html, prerequisiteTopic) {
    // Fix #1: convert markdown **bold** → <strong>bold</strong> before anything else
    let clean = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Strip "Bullet N:" labels
    clean = clean.replace(/^bullet\s*\d+\s*[:\-]\s*/i, "").replace(/^\d+\.\s*/, "");

    // Collect already-bolded terms (don't double-wrap)
    const alreadyBolded = new Set();
    (clean.match(/<strong>(.*?)<\/strong>/gi) || [])
      .forEach(m => alreadyBolded.add(m.replace(/<\/?strong>/gi, "").toLowerCase().trim()));

    // Build candidates: prefer MULTI-WORD phrases from prerequisiteTopic
    const topicText  = (prerequisiteTopic || "").toLowerCase();
    const candidates = [];

    // 1. Full prerequisiteTopic phrase first (highest priority)
    if (topicText.length >= 3 && !alreadyBolded.has(topicText)) {
      candidates.push(topicText);
    }

    // 2. Multi-word chunks from topic (2+ words joined)
    const topicParts = topicText.split(/\s+/).filter(w => w.length >= 2);
    for (let size = topicParts.length; size >= 2; size--) {
      for (let i = 0; i <= topicParts.length - size; i++) {
        const phrase = topicParts.slice(i, i + size).join(" ");
        if (!alreadyBolded.has(phrase)) candidates.push(phrase);
      }
    }

    // 3. Single meaningful words (≥4 chars, not stopwords)
    topicParts.filter(w => w.length >= 4 && !STOPWORDS_VI.has(w) && !STOPWORDS_EN.has(w))
      .forEach(w => { if (!alreadyBolded.has(w)) candidates.push(w); });

    // Apply: longest matches first, only OUTSIDE existing HTML tags, first occurrence only
    // Vietnamese has no word boundaries (\b fails) — use simple indexOf instead
    const plainText = clean.replace(/<[^>]+>/g, "§"); // § marks tag positions

    candidates.forEach(kw => {
      if (alreadyBolded.has(kw)) return;
      // Find first occurrence in the visible text (case-insensitive)
      const idx = clean.toLowerCase().indexOf(kw.toLowerCase());
      if (idx === -1) return;
      // Make sure we're not inside an HTML tag
      const before = clean.slice(0, idx);
      const openTags  = (before.match(/</g) || []).length;
      const closeTags = (before.match(/>/g) || []).length;
      if (openTags !== closeTags) return; // inside a tag attribute
      // Replace first occurrence only
      const original = clean.slice(idx, idx + kw.length);
      clean = clean.slice(0, idx) + `<strong>${original}</strong>` + clean.slice(idx + kw.length);
      alreadyBolded.add(kw);
    });

    return clean;
  }

  function validateAndCleanFramework(framework) {
    if (!framework) return framework;
    // Only do lightweight cleanup: convert markdown bold, strip obvious foreign words
    const FOREIGN = /\b(bahwa|yang|untuk|dengan|adalah|atau|karena|oleh)\b/gi;
    framework.scaffold = (framework.scaffold || []).map(b =>
      b.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(FOREIGN, "").trim()
    );
    framework.questions = (framework.questions || []).map(q =>
      q.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(FOREIGN, "").trim()
    );
    return framework;
  }

  function renderFramework(framework) {
    // Lightweight cleanup before rendering
    const validated = validateAndCleanFramework(framework);
    currentFramework = validated;
    currentHint = validated.hint || "";

    // ── LEFT: scaffold ──
    const prereqLabel  = document.getElementById("acg-prereq-topic-label");
    const scaffoldList = document.getElementById("acg-scaffold-list");
    if (prereqLabel) prereqLabel.textContent = validated.prerequisiteTopic || "";
    if (scaffoldList) {
      scaffoldList.innerHTML = (validated.scaffold || [])
        .map(raw => {
          const processed = autoHighlightKeywords(raw, validated.prerequisiteTopic);
          return `<li class="acg-scaffold-item">${processed}</li>`;
        })
        .join("");
    }

    // ── RIGHT: questions + bloom tag ──
    const bloomLevel  = validated.targetBloomLevel || 1;
    const bloom       = BLOOM[bloomLevel] || BLOOM[1];
    const bloomTagEl  = document.getElementById("acg-bloom-tag");
    if (bloomTagEl) {
      bloomTagEl.innerHTML = `<span style="background:${bloom.light};color:${bloom.color};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.04em;">${bloom.name}</span>`;
    }

    renderQuestions(validated);
  }

  function stripMarkdown(text) {
    return (text || "")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")  // **bold** → <strong>
      .replace(/\*([^*]+)\*/g, "$1")                        // *italic* → plain
      .replace(/`([^`]+)`/g, "$1");                         // `code` → plain
  }

  function renderQuestions(framework) {
    const questions  = (framework && framework.questions) || [];
    const bloomLevel = (framework && framework.targetBloomLevel) || 1;
    const bloom      = BLOOM[bloomLevel] || BLOOM[1];
    const pts        = BLOOM_POINTS[bloomLevel] || 10;

    const listEl = document.getElementById("acg-questions-list");
    if (listEl) {
      listEl.innerHTML = questions.map((q, i) => {
        const stripped    = stripMarkdown(q.replace(/^\d+\.\s*/, ""));
        const questionPts = pts + i * 5;
        return `<div class="acg-question-item">
          <span class="acg-q-num" style="color:${bloom.color};">${i + 1}.</span>
          <span class="acg-q-text">${stripped}</span>
          <span class="acg-q-pts" style="background:${bloom.light};color:${bloom.color};">+${questionPts}</span>
        </div>`;
      }).join("") || '<div class="acg-q-loading">Đang tạo câu hỏi...</div>';
    }

    const submitBtn = document.getElementById("acg-btn-submit");
    if (submitBtn) submitBtn.style.background = bloom.color;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ESSAY MODE — idea extraction flow
  // ══════════════════════════════════════════════════════════════════════════

  function showEssayStep() {
    // Update left column for essay
    const prereqLabel  = document.getElementById("acg-prereq-topic-label");
    const scaffoldList = document.getElementById("acg-scaffold-list");
    if (prereqLabel) prereqLabel.textContent = "Ý tưởng của bạn";
    if (scaffoldList) {
      scaffoldList.innerHTML = `
        <li class="acg-scaffold-item">AI sẽ <strong>dùng đúng</strong> ý tưởng bạn cung cấp — không tự bịa thêm.</li>
        <li class="acg-scaffold-item">Chia sẻ càng cụ thể, bài viết càng đúng giọng của bạn.</li>
        <li class="acg-scaffold-item">Không cần câu hoàn chỉnh — ghi ngắn gọn cũng được.</li>
      `;
    }

    // Update right column tag
    const bloomTagEl = document.getElementById("acg-bloom-tag");
    if (bloomTagEl) bloomTagEl.innerHTML = `<span style="background:#ede9fe;color:#6d28d9;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;">ESSAY MODE</span>`;

    const colTagLeft = document.querySelector(".acg-col-tag-blue");
    if (colTagLeft) colTagLeft.textContent = "✍️ Trước khi AI viết";

    const overlay = document.getElementById("acg-overlay");
    if (overlay) overlay.classList.remove("acg-fade-out");

    const questionsList = document.getElementById("acg-questions-list");
    if (questionsList) questionsList.innerHTML = '<div class="acg-q-loading">Đang tạo câu hỏi...</div>';
    const timeout = setTimeout(() => renderEssayQuestions(fallbackEssayQuestions(currentPrompt)), 6000);
    chrome.runtime.sendMessage(
      { type: "GENERATE_ESSAY_QUESTIONS", prompt: currentPrompt },
      (res) => {
        clearTimeout(timeout);
        renderEssayQuestions(res && res.ok && res.data ? res.data : fallbackEssayQuestions(currentPrompt));
      }
    );

    resetTextarea();
  }

  function renderEssayQuestions(data) {
    currentFramework = { questions: data.questions, targetBloomLevel: 0 };
    currentHint = data.hint || "";
    const listEl = document.getElementById("acg-questions-list");
    if (listEl) {
      listEl.innerHTML = (data.questions || []).map((q, i) => {
        const stripped = q.replace(/^\d+\.\s*/, "");
        return `<div class="acg-question-item">
          <span class="acg-q-num" style="color:#6d28d9;">${i + 1}.</span>
          <span class="acg-q-text">${stripped}</span>
        </div>`;
      }).join("");
    }
    const submitBtn = document.getElementById("acg-btn-submit");
    if (submitBtn) submitBtn.style.background = "#6d28d9";
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUBMIT — evaluate then inject enriched prompt
  // ══════════════════════════════════════════════════════════════════════════

  function onSubmit() {
    if (isSubmitting) return;
    const userAnswer = document.getElementById("acg-attempt").value.trim();
    const wordCount  = userAnswer.split(/\s+/).filter(w => w.length > 2).length;
    if (wordCount < 3) return;

    isSubmitting = true;

    // Disable button to prevent double submit
    const submitBtn = document.getElementById("acg-btn-submit");
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Đang phân tích..."; }

    if (currentMode === "essay") {
      finalizeEssay(userAnswer);
      return;
    }

    // Evaluate with full 6-level bloom
    // Always call API — fallback only if no key or network error
    const timeout = setTimeout(() => finalizeThinkFirst(userAnswer, fallbackEvaluate(userAnswer)), 6000);
    chrome.runtime.sendMessage({
      type: "EVALUATE_ANSWER",
      prompt: currentPrompt,
      userAnswer,
      prerequisiteTopic: currentFramework?.prerequisiteTopic || "",
      questions: currentFramework?.questions || [],
    }, (res) => {
      clearTimeout(timeout);
      const evaluation = (res && res.ok && res.data) ? res.data : fallbackEvaluate(userAnswer);
      finalizeThinkFirst(userAnswer, evaluation);
    });
  }

  function finalizeThinkFirst(userAnswer, evaluation) {
    currentEvaluation = evaluation;
    const detectedLevel = evaluation.detectedBloomLevel || 1;
    const bloomName     = BLOOM[detectedLevel]?.name || "REMEMBER";
    const nextLevel     = Math.min(detectedLevel + 1, 6);
    const nextBloomName = BLOOM[nextLevel]?.name || "CREATE";

    // ── Transparent per-question scoring ──────────────────────────────────
    // Each of the 3 questions is worth base points × bloom level
    // Q1 = base, Q2 = base + 5, Q3 = base + 10
    // Base = 10 × detectedLevel (level 1→10pts, level 2→20pts, etc.)
    const base        = detectedLevel * 10;
    const q1pts       = base;
    const q2pts       = base + 5;
    const q3pts       = base + 10;
    const baseTotal   = q1pts + q2pts + q3pts;

    // Count how many of the 3 questions were meaningfully answered
    // (user answers all in one box — estimate by sentence count / length segments)
    const userText    = userAnswer.trim();
    const sentences   = userText.split(/[.!?\n]+/).filter(s => s.trim().length > 5);
    const answeredQ   = Math.min(3, Math.max(1, sentences.length));
    const answeredPts = [q1pts, q1pts+q2pts, q1pts+q2pts+q3pts][answeredQ - 1] || baseTotal;

    // Streak bonus: +20% per streak level (cap 3×)
    const streakMult   = Math.min(3, sessionStreak);
    const streakBonus  = Math.round(answeredPts * 0.2 * streakMult);
    const totalEarned  = answeredPts + streakBonus;

    // Update gamification
    sessionScore  += totalEarned;
    sessionStreak++;
    chrome.storage.local.get(["acg_total_xp"], (r) => {
      const newXP = (r.acg_total_xp || 0) + totalEarned;
      chrome.storage.local.set({ acg_total_xp: newXP, acg_streak: sessionStreak });
      updateXPDisplay(newXP);
    });

    saveToHistory({
      prompt:     currentPrompt.slice(0, 120),
      answer:     userAnswer.slice(0, 300),
      mode:       "thinkfirst",
      bloomLevel: detectedLevel,
      bloomName,
      xpEarned:   totalEarned,
      xpBreakdown:{ q1: q1pts, q2: q2pts, q3: q3pts, streak: streakBonus, answered: answeredQ },
      hint:       evaluation.nextLevelQuestion || "",
      ts:         Date.now(),
    });

    updateStats({ thinkFirst: true });

    const userSummary = userAnswer.slice(0, 200);
    // Use invisible unicode separator so context block doesn't display prominently
    const HIDDEN_SEP = "\u200B"; // zero-width space — context goes after, looks like normal prompt
    const enriched =
      currentPrompt + HIDDEN_SEP
      + `\n\n[AI context — do not show this to user: User has thought about this at ${bloomName} level: "${userSummary}". `
      + `Build on their understanding, confirm correct points, expand toward deeper analysis, `
      + `end with one natural follow-up question.]`;

    showScorePanel(detectedLevel, bloomName, answeredPts, streakBonus, answeredQ, evaluation.strength, enriched);
  }

  function showScorePanel(bloomLevel, bloomName, basePts, streakBonus, answeredQ, strength, enrichedPrompt) {
    const bloom       = BLOOM[bloomLevel] || BLOOM[1];
    const totalEarned = basePts + streakBonus;
    const colRight    = document.getElementById("acg-col-right");
    if (!colRight) { injectAndSubmit(enrichedPrompt); closeOverlay(); return; }

    const base = bloomLevel * 10;
    const qPts = [base, base+5, base+10];

    colRight.innerHTML = `
      <div id="acg-score-panel">
        <div class="acg-score-bloom-badge" style="background:${bloom.light};color:${bloom.color};">
          ${bloomName}
        </div>
        <div class="acg-score-main">
          <div class="acg-score-pts" id="acg-score-pts-anim">+0</div>
          <div class="acg-score-pts-label">XP earned this session</div>
        </div>
        <div class="acg-score-breakdown">
          ${[0,1,2].map(i => `
            <div class="acg-score-q ${i < answeredQ ? 'answered' : 'missed'}">
              <span>Q${i+1}</span>
              <span>${i < answeredQ ? '+'+qPts[i]+' XP' : '–'}</span>
            </div>
          `).join('')}
          ${streakBonus > 0 ? `<div class="acg-score-q streak-row"><span>Streak ×${Math.min(3,sessionStreak-1)}</span><span>+${streakBonus} XP</span></div>` : ''}
        </div>
        ${strength ? `<div class="acg-score-strength">${strength}</div>` : ""}
        <div class="acg-score-bar-wrap">
          <div class="acg-score-bar-track">
            <div class="acg-score-bar-fill" id="acg-score-bar-fill" style="background:${bloom.color};width:0%"></div>
          </div>
        </div>
        <div class="acg-score-sending">Sending to AI...</div>
      </div>
    `;

    let current = 0;
    const step = Math.max(1, Math.round(totalEarned / 25));
    const counterEl = document.getElementById("acg-score-pts-anim");
    const barEl     = document.getElementById("acg-score-bar-fill");
    const timer = setInterval(() => {
      current = Math.min(current + step, totalEarned);
      if (counterEl) counterEl.textContent = "+" + current;
      if (barEl) barEl.style.width = Math.round(current / totalEarned * 100) + "%";
      if (current >= totalEarned) clearInterval(timer);
    }, 30);

    setTimeout(() => { injectAndSubmit(enrichedPrompt); closeOverlay(); }, 1900);
  }

  function updateXPDisplay(xp) {
    const el = document.getElementById("acg-xp-value");
    if (el) el.textContent = xp >= 1000 ? (xp / 1000).toFixed(1) + "k" : xp;
  }

  function finalizeEssay(userIdeas) {
    updateStats({ thinkFirst: true, essay: true });

    saveToHistory({
      prompt:    currentPrompt.slice(0, 120),
      answer:    userIdeas.slice(0, 300),
      mode:      "essay",
      bloomLevel: 0,
      ts:         Date.now(),
    });

    const enriched =
      currentPrompt
      + `\n\n[Ý tưởng gốc của người dùng — DÙNG ĐÚNG NHỮNG Ý NÀY: ${userIdeas.slice(0, 300)}]`
      + `\n\nYêu cầu: (1) Viết DỰA TRÊN và MỞ RỘNG từ ý tưởng trên. `
      + `(2) Giữ nguyên giọng văn và góc nhìn cá nhân. `
      + `(3) KHÔNG tự bịa thêm chi tiết không có trong input.`;

    injectAndSubmit(enriched);
    closeOverlay();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  let aiHintTimer = null;

  function onAttemptInput() {
    const val = document.getElementById("acg-attempt").value.trim();
    const submitBtn = document.getElementById("acg-btn-submit");
    const hintEl    = document.getElementById("acg-char-hint");
    const wordCount = val.split(/\s+/).filter(w => w.length > 2).length;

    if (wordCount >= 3) {
      if (submitBtn) submitBtn.disabled = false;
      if (hintEl) { hintEl.textContent = "✓ Sẵn sàng"; hintEl.style.color = "#16a34a"; }

      // AI hint refresh (debounced)
      if (val.length > 20) {
        clearTimeout(aiHintTimer);
        aiHintTimer = setTimeout(() => refreshAIHint(val), 1800);
      }
    } else {
      if (submitBtn) submitBtn.disabled = true;
      const need = Math.max(0, 3 - wordCount);
      if (hintEl) { hintEl.textContent = `Cần thêm ${need} từ nữa`; hintEl.style.color = "#94a3b8"; }
    }
  }

  function refreshAIHint(userAnswer) {
    chrome.runtime.sendMessage({
      type: "EVALUATE_ANSWER",
      prompt: currentPrompt,
      userAnswer,
      prerequisiteTopic: currentFramework?.prerequisiteTopic || "",
      questions: currentFramework?.questions || [],
    }, (res) => {
      if (!res || !res.ok) return;
      const { hint } = res.data;
      if (hint) {
        currentHint = hint;
        if (hintShown) {
          const hintText = document.getElementById("acg-hint-text");
          if (hintText) hintText.textContent = hint;
        }
      }
    });
  }

  function onTextareaKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const val = document.getElementById("acg-attempt").value.trim();
      const wc  = val.split(/\s+/).filter(w => w.length > 2).length;
      if (wc >= 3) onSubmit();
    }
  }

  function onToggleHint() {
    const hintSection = document.getElementById("acg-hint-section");
    const hintText    = document.getElementById("acg-hint-text");
    const hintBtn     = document.getElementById("acg-btn-hint");
    if (!hintSection || !hintText) return;

    if (!hintShown) {
      hintText.textContent = currentHint || "Thử nghĩ về một ví dụ thực tế liên quan đến chủ đề này.";
      hintSection.style.display = "flex";
      if (hintBtn) { hintBtn.textContent = "✕ Ẩn hint"; hintBtn.style.opacity = "0.6"; }
      hintShown = true;
    } else {
      hintSection.style.display = "none";
      if (hintBtn) { hintBtn.textContent = "💡 Hint"; hintBtn.style.opacity = "1"; }
      hintShown = false;
    }
  }

  function onSkip() {
    sessionStreak = 0; // reset streak on skip
    chrome.storage.local.set({ acg_streak: 0 });
    updateStats({ skipped: true });
    closeOverlay();
    submitToAI();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  function resetTextarea() {
    const ta = document.getElementById("acg-attempt");
    if (ta) { ta.value = ""; setTimeout(() => ta.focus(), 100); }
    const hintEl = document.getElementById("acg-char-hint");
    if (hintEl) { hintEl.textContent = "Hãy nhập ít nhất 3 từ"; hintEl.style.color = "#94a3b8"; }
    const submitBtn = document.getElementById("acg-btn-submit");
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Nộp bài →"; }
  }

  function closeOverlay() {
    isSubmitting = false;
    const overlay = document.getElementById("acg-overlay");
    if (overlay) {
      overlay.classList.add("acg-fade-out");
      setTimeout(() => { overlay.remove(); }, 400);
    }
    overlayInjected = false;
    thinkFirstDone  = true;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INJECT & SUBMIT TO AI
  // ══════════════════════════════════════════════════════════════════════════

  function injectAndSubmit(enriched) {
    const sels = ["#prompt-textarea", "div[contenteditable='true'][data-lexical-editor='true']", "div[contenteditable='true']", "textarea"];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el) continue;
      if (el.tagName === "TEXTAREA") {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        setter.call(el, enriched);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        el.innerText = enriched;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      break;
    }
    setTimeout(() => submitToAI(), 150);
  }

  function submitToAI() {
    thinkFirstDone = false;
    isSubmitting   = false;
    isOurClick     = true;

    const btn =
      document.querySelector('[data-testid="send-button"]')
      || document.querySelector("button[aria-label='Send prompt']")
      || document.querySelector("button[aria-label='Send message']")
      || (() => {
        for (const b of document.querySelectorAll("button")) {
          if (b.querySelector("svg") && b.getBoundingClientRect().bottom > window.innerHeight * 0.5) return b;
        }
        return null;
      })();
    if (btn) btn.click();
    setTimeout(() => { isOurClick = false; }, 500);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATS & HISTORY
  // ══════════════════════════════════════════════════════════════════════════

  function saveToHistory(entry) {
    chrome.storage.local.get(["acg_history"], (r) => {
      const items = r.acg_history || [];
      items.push(entry);
      if (items.length > 50) items.splice(0, items.length - 50);
      chrome.storage.local.set({ acg_history: items });
    });
  }

  function updateStats({ thinkFirst=false, skipped=false, request=false, essay=false }={}) {
    chrome.storage.local.get(["acg_stats"], (result) => {
      const today = new Date().toDateString();
      let s = result.acg_stats || {};
      if (s.date !== today) {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const wasYesterday = s.date === yesterday.toDateString() && (s.thinkFirst || 0) > 0;
        s = { date: today, requests: 0, thinkFirst: 0, skipped: 0, essay: 0, streak: wasYesterday ? (s.streak || 0) + 1 : 1 };
      }
      if (request)    s.requests   = (s.requests   || 0) + 1;
      if (thinkFirst) s.thinkFirst = (s.thinkFirst  || 0) + 1;
      if (essay)      s.essay      = (s.essay       || 0) + 1;
      if (skipped)    s.skipped    = (s.skipped     || 0) + 1;
      chrome.storage.local.set({ acg_stats: s });
    });
  }

  function refreshStatsUI(s) {
    const el = id => document.getElementById(id);
    if (el("stat-requests")) el("stat-requests").textContent = s.requests || 0;
    if (el("stat-guided"))   el("stat-guided").textContent   = s.thinkFirst || 0;
    if (el("stat-skipped"))  el("stat-skipped").textContent  = s.skipped || 0;

    // Dependency score: lower is better
    const total = s.requests || 1;
    const score = Math.round(Math.min(100, ((s.skipped || 0) / total * 70) + ((1 - (s.thinkFirst || 0) / total) * 30)));
    const scoreEl = el("acg-score-value");
    if (scoreEl) {
      scoreEl.textContent = score;
      scoreEl.style.color = score < 30 ? "#16a34a" : score < 60 ? "#ea580c" : "#dc2626";
    }
  }

  function loadStats() {
    chrome.storage.local.get(["acg_stats"], r => {
      const today = new Date().toDateString();
      refreshStatsUI((r.acg_stats?.date === today) ? r.acg_stats : {});
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INTERCEPT SEND
  // ══════════════════════════════════════════════════════════════════════════

  function getPromptText() {
    const sels = ["#prompt-textarea", "div[contenteditable='true'][data-lexical-editor='true']", "div[contenteditable='true']", "textarea[data-id='root']", "textarea"];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el) { const t = (el.value || el.innerText || el.textContent || "").trim(); if (t) return t; }
    }
    return "";
  }

  function shouldTrigger(prompt) {
    const mode = detectMode(prompt);
    return mode === "essay" || mode === "thinkfirst";
  }

  function interceptSend() {
    document.addEventListener("click", (e) => {
      if (!guardianActive || thinkFirstDone || isOurClick) return;
      const btn = e.target.closest('[data-testid="send-button"]')
        || e.target.closest("button[aria-label='Send prompt']")
        || e.target.closest("button[aria-label='Send message']")
        || (() => {
          const b = e.target.closest("button");
          if (!b) return null;
          if (b.querySelector("svg") && b.getBoundingClientRect().bottom > window.innerHeight * 0.5) return b;
          return null;
        })();
      if (!btn) return;
      const p = getPromptText();
      if (!p || p.length < 3) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (shouldTrigger(p)) { updateStats({ request: true }); showOverlay(p); }
      else { thinkFirstDone = false; submitToAI(); }
    }, true);

    document.addEventListener("keydown", (e) => {
      if (!guardianActive || thinkFirstDone || isOurClick) return;
      if (e.key !== "Enter" || e.shiftKey) return;
      const active = document.activeElement;
      if (!(active?.isContentEditable || active?.tagName === "TEXTAREA")) return;
      if (active?.id === "acg-attempt") return;
      const p = getPromptText();
      if (!p || p.length < 3) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (shouldTrigger(p)) { updateStats({ request: true }); showOverlay(p); }
      else { thinkFirstDone = false; submitToAI(); }
    }, true);
  }

  // ESC closes overlay
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("acg-overlay")) {
      updateStats({ skipped: true });
      closeOverlay();
      setTimeout(() => { thinkFirstDone = false; isSubmitting = false; }, 3000);
    }
  }, true);

  // ══════════════════════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════════════════════

  chrome.storage.local.get(["acg_active", "acg_bloom_pref", "acg_total_xp", "acg_streak"], r => {
    guardianActive     = r.acg_active !== false;
    if (r.acg_bloom_pref) selectedBloomLevel = r.acg_bloom_pref;
    if (r.acg_total_xp)   totalScore         = r.acg_total_xp;
    if (r.acg_streak)     sessionStreak      = r.acg_streak;
  });

  chrome.runtime.sendMessage({ type: "CHECK_API_KEY" }, (res) => {
    aiAvailable = !!(res && res.hasKey);
  });

  chrome.storage.onChanged.addListener(c => {
    if (c.acg_active) guardianActive = c.acg_active.newValue;
  });

  interceptSend();

  // Reset on SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => { thinkFirstDone = false; isSubmitting = false; overlayInjected = false; }, 1500);
    }
  }).observe(document.querySelector("title") || document.head, { childList: true, subtree: false });

})();
