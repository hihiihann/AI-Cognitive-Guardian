# AI Cognitive Guardian (ACG)

> **"The biggest risk of AI is thinking loss."**  
> Build deeper understanding — not AI dependency.

ACG là một Chrome Extension can thiệp hành vi người dùng ngay tại điểm gõ prompt — **trước khi AI trả lời** — nhằm kích hoạt tư duy độc lập và ngăn chặn sự lệ thuộc nhận thức vào AI.

---

## Tại sao cần ACG?

Sự tiện lợi của AI đang tạo ra một vấn đề ít được nhận ra: người dùng dần **lệ thuộc vào AI trong việc ra quyết định**.

- **74%** người dùng làm theo đề xuất của AI ngay cả khi nó sai *(Stanford, 2024)*
- **64%** người dùng AI lo ngại mất khả năng tự suy nghĩ *(Pew Research, 2024)*
- Microsoft Work Trend 2025 gọi đây là **"cognitive offloading"** — rủi ro hàng đầu trong workforce AI adoption

ACG không ngăn bạn dùng AI — mà thay đổi cách dùng AI từ **passive consumption** sang **active thinking**.

---

## Tính năng chính

### 🔍 Think First Mode
Khi bạn gửi một câu hỏi, ACG hiện ra **trước khi AI trả lời**:
- **Scaffold kiến thức nền** (4 bullets): Hook → Contrast → Condition → Bridge, giúp bạn kết nối với kiến thức đã có
- **3 câu hỏi gợi mở** được calibrate theo Bloom's Taxonomy (6 bậc tư duy)
- Bạn viết câu trả lời → ACG đánh giá bậc tư duy → AI nhận enriched prompt kèm suy nghĩ của bạn

### ✍️ Essay Mode
Khi bạn nhờ AI viết bài/soạn nội dung, ACG capture ý tưởng gốc của bạn trước → AI viết **dựa trên** tư duy của bạn, không thay thế nó.

### 🎮 Hệ thống Gamification
- **6 Thinking Levels** theo Bloom's Taxonomy: Remember → Understand → Apply → Analyze → Evaluate → Create
- **XP System**: Earn điểm theo bậc tư duy đạt được, streak bonus khi không bỏ qua
- **Score Panel** với animated counter và breakdown sau mỗi session
- **Dashboard popup**: Dependency Score, Thinking Level, lịch sử 50 sessions gần nhất

---

## Kiến trúc kỹ thuật

```
manifest.json       ← Chrome Extension MV3 config
background.js       ← Service worker: Groq API, cache, message handler  
content.js          ← UI overlay, mode detection, intercept send button
popup.html / .js    ← Dashboard: stats, XP, history, API key management
popup-styles.css    ← Styles cho overlay (2-column panel, score panel)
```

### Data Flow

```
User types prompt
      ↓
content.js intercepts → detectMode(prompt)
      ↓
Mode: 'thinkfirst' → showFrameworkStep()
      ↓
chrome.runtime.sendMessage(GENERATE_FRAMEWORK) → background.js
      ↓
background.js → Groq API (llama-3.1-8b-instant → fallback models)
      ↓
Render scaffold (left col) + 3 questions (right col)
      ↓
User writes answer → onSubmit()
      ↓
EVALUATE_ANSWER → Bloom level detection → XP calculation
      ↓
showScorePanel() → injectAndSubmit(enrichedPrompt)
```

### AI Models (Groq API — auto fallback)

| Priority | Model | Notes |
|----------|-------|-------|
| 1st | `llama-3.1-8b-instant` | Default |
| 2nd | `llama3-8b-8192` | Fallback khi rate limited |
| 3rd | `gemma2-9b-it` | Last resort |

---

## Cài đặt

### Yêu cầu
- Google Chrome (hoặc Chromium-based browser)
- Groq API key miễn phí tại [console.groq.com](https://console.groq.com)

### Bước cài đặt

1. **Clone repo**
   ```bash
   git clone https://github.com/<your-username>/ai-cognitive-guardian.git
   cd ai-cognitive-guardian
   ```

2. **Load extension vào Chrome**
   - Mở `chrome://extensions/`
   - Bật **Developer mode** (góc trên phải)
   - Chọn **Load unpacked** → chọn thư mục repo

3. **Cấu hình API key**
   - Click icon ACG trên toolbar
   - Chọn **"Set key"** → paste Groq API key → **Save**
   - Extension tự động test kết nối

4. **Truy cập ChatGPT** và bắt đầu dùng — ACG tự động kích hoạt!

---

## Cách dùng

1. Vào [chatgpt.com](https://chatgpt.com) và gõ bất kỳ câu hỏi nào
2. Khi bấm Send, ACG hiện overlay 2 cột:
   - **Trái**: Scaffold kiến thức nền
   - **Phải**: 3 câu hỏi gợi mở
3. Chọn knowledge level của bạn (1–6) từ dropdown
4. Viết câu trả lời (tối thiểu 3 từ)
5. Bấm **"Nộp bài →"** → xem score và Bloom level
6. AI nhận prompt có enriched context từ suy nghĩ của bạn

> Muốn bỏ qua? Bấm **"Bỏ qua"** — nhưng streak bị reset và Dependency Score tăng lên.

---

## Bloom's Taxonomy Levels

| Level | Tên | XP Range | Màu |
|-------|-----|----------|-----|
| 1 | Remember / Ghi nhớ | 0–49 XP | Gray |
| 2 | Understand / Hiểu | 50–149 XP | Blue |
| 3 | Apply / Vận dụng | 150–299 XP | Green |
| 4 | Analyze / Phân tích | 300–499 XP | Orange |
| 5 | Evaluate / Đánh giá | 500–799 XP | Purple |
| 6 | Create / Sáng tạo | 800+ XP | Pink |

---

## Storage

Tất cả dữ liệu lưu local trong `chrome.storage.local` — không có server, không tracking:

| Key | Type | Mô tả |
|-----|------|--------|
| `acg_api_key` | string | Groq API key |
| `acg_active` | boolean | Guardian bật/tắt |
| `acg_bloom_pref` | number 1–6 | Knowledge level ưa thích |
| `acg_total_xp` | number | Tổng XP tích lũy |
| `acg_streak` | number | Session streak hiện tại |
| `acg_stats` | object | Daily stats |
| `acg_history` | array[50] | Lịch sử 50 sessions gần nhất |

---

## Dành cho Developer

### Mode Detection Logic

| Mode | Trigger | Hành vi |
|------|---------|---------|
| `thinkfirst` | Question words, Vietnamese patterns, length > 20 chars | Scaffold + 3 Bloom questions |
| `essay` | Essay verbs + nouns (viết, soạn, draft...) | Capture ideas trước khi AI viết |
| `bypass` | Greeting, math, URL, code, < 2 words | Pass thẳng đến AI |

### XP Calculation

```
Base = detectedBloomLevel × 10
Q1 = Base pts
Q2 = Base + 5 pts  
Q3 = Base + 10 pts
streakBonus = basePts × 0.2 × min(sessionStreak, 3)
totalEarned = basePts + streakBonus
```

### Fallback Evaluation (không có API)

Rule-based khi API unavailable (timeout 6s):
- < 4 words → Level 1
- ≥ 8 words → Level 2
- reasoning words ≥ 1 && ≥ 15 words → Level 3
- reasoning words ≥ 2 && ≥ 25 words → Level 4

---

## Roadmap

- [ ] Support thêm AI platforms (Claude, Gemini, Perplexity...)
- [ ] Spaced repetition cho các topic đã học
- [ ] Sync progress qua nhiều devices
- [ ] Export learning report (PDF)
- [ ] Custom Bloom question templates

---

## Contributing

Pull requests are welcome! Để contribute:

1. Fork repo
2. Tạo branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'Add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open Pull Request

---

## License

MIT License — xem [LICENSE](LICENSE) để biết thêm.
