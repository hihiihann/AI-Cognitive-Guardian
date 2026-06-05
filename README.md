# AI Cognitive Guardian (ACG)

> **"The biggest risk of AI is thinking loss."**
> Build deeper understanding — not AI dependency.

ACG là một **Chrome Extension** can thiệp hành vi ngay tại điểm bạn gõ prompt — **trước khi AI trả lời** — nhằm kích hoạt tư duy độc lập và ngăn chặn sự lệ thuộc nhận thức vào AI.

<img width="465" height="392" alt="Picture 1" src="https://github.com/user-attachments/assets/dfe3258c-524b-4e2a-b545-f34c0e7e58ff" />
<img width="435" height="486" alt="Picture 2" src="https://github.com/user-attachments/assets/b678f0c1-48fc-404f-8365-52ea78532bfd" />


---

## Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Tính năng](#-tính-năng)
- [Demo](#-demo)
- [Cài đặt](#-cài-đặt)
- [Cách sử dụng](#-cách-sử-dụng)
- [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
- [Kiến trúc kỹ thuật](#️-kiến-trúc-kỹ-thuật)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

---

## Giới thiệu

Sự tiện lợi của AI đang tạo ra một vấn đề ít được nhận ra: người dùng dần **lệ thuộc vào AI trong việc ra quyết định**. Quá trình này hình thành từ những thói quen rất nhỏ — ít tự suy nghĩ trước khi hỏi, ít kiểm chứng câu trả lời, coi AI là nguồn mặc định đúng.

| Nghiên cứu | Phát hiện |
|---|---|
| Stanford University (2024) | **74%** người dùng làm theo AI ngay cả khi nó sai |
| Pew Research (2024) | **64%** người dùng lo ngại mất khả năng tự suy nghĩ |
| Microsoft Work Trend (2025) | Gọi đây là **"cognitive offloading"** — rủi ro hàng đầu trong AI adoption |

**ACG không ngăn bạn dùng AI** — mà thay đổi cách dùng từ *passive consumption* sang *active thinking*. Extension hoạt động như một lớp can thiệp chủ động: trước khi AI trả lời, bạn phải suy nghĩ trước.

---

## Tính năng

| # | Tính năng | Mô tả |
|---|-----------|-------|
| 🔍 | **Think First Mode** | Intercept prompt → hiển thị scaffold kiến thức nền + 3 câu hỏi Bloom's Taxonomy → bạn trả lời → AI nhận enriched prompt |
| ✍️ | **Essay Mode** | Capture ý tưởng gốc của bạn trước khi AI viết bài — AI hỗ trợ, không thay thế |
| 🎮 | **XP & Thinking Levels** | 6 bậc tư duy theo Bloom, tích XP theo chất lượng câu trả lời, streak bonus |
| 📊 | **Dependency Score** | Đo mức độ lệ thuộc AI theo ngày (0–100, thấp hơn là tốt hơn) |
| 🧩 | **Scaffold kiến thức nền** | 4 bullets: Hook → Contrast → Condition → Bridge, kết nối prereq với topic gốc |
| 🤖 | **AI Bloom Evaluation** | Groq API đánh giá bậc tư duy câu trả lời theo rubric 6 levels |
| 🔒 | **100% Local Storage** | Không server, không tracking — mọi dữ liệu ở máy bạn |

---

## Demo

### Think First Flow — từ prompt đến enriched response

```
Bạn gõ: "ROI là gì và tại sao quan trọng?"
           ↓
ACG intercepts trước khi gửi
           ↓
┌─────────────────────────────────────────────────────────┐
│  LEFT PANEL: Kiến thức nền (Lãi suất)                   │
│  • Hook: Bạn đã từng gửi tiết kiệm và nhận lãi chưa?   │
│  • Contrast: Lãi suất đơn ≠ lãi suất kép               │
│  • Condition: Chỉ dùng khi tài sản sinh lợi theo TG    │
│  • Bridge: Hiểu lãi suất → hiểu ROI vì...              │
│                    │  RIGHT PANEL: 3 câu hỏi            │
│                    │  1. Dựa vào lãi suất, ROI đo gì?  │
│                    │  2. Khi nào ROI phụ thuộc lãi?    │
│                    │  3. Thiết kế hệ thống tính ROI?   │
│                    │  [Textarea viết câu trả lời...]   │
└─────────────────────────────────────────────────────────┘
           ↓
Bạn viết câu trả lời → ACG đánh giá → Bloom Level 3 (Apply) 🟢
           ↓
ChatGPT nhận: "ROI là gì... [Suy nghĩ của tôi: ROI giống
lãi suất nhưng tổng quát hơn vì...] Hãy build lên từ đây."
```

### Bloom Level sau một tuần dùng ACG

```
Ngày 1:  ████░░░░░░  Level 2 - Understand  (50 XP)
Ngày 3:  ██████░░░░  Level 3 - Apply       (180 XP)
Ngày 7:  ████████░░  Level 4 - Analyze     (340 XP)
```

---

## Cài đặt

### Yêu cầu

- **Google Chrome** v88+ (hoặc Chromium-based: Edge, Brave, Arc...)
- **Groq API key** — miễn phí tại [console.groq.com](https://console.groq.com) (không cần thẻ tín dụng)

### Bước 1 — Tải extension

```bash
git clone https://github.com/<your-username>/ai-cognitive-guardian.git
cd ai-cognitive-guardian
```

Hoặc tải ZIP từ [Releases](https://github.com/<your-username>/ai-cognitive-guardian/releases) rồi giải nén.

### Bước 2 — Load vào Chrome

1. Mở `chrome://extensions/` trên trình duyệt
2. Bật **Developer mode** (toggle góc trên phải)
3. Chọn **Load unpacked** → chọn thư mục vừa clone/giải nén
4. Icon ACG xuất hiện trên toolbar ✅

### Bước 3 — Cấu hình API key

1. Click icon **ACG** trên toolbar
2. Chọn **"Set key"** → paste Groq API key của bạn → **Save**
3. Extension tự test kết nối — nếu thấy `✅ API connected!` là xong

> **Không có API key?** ACG vẫn hoạt động với rule-based evaluation (không cần AI). Tuy nhiên scaffold và câu hỏi sẽ kém chất lượng hơn.

### Bước 4 — Dùng thôi!

Vào [chatgpt.com](https://chatgpt.com) và gõ bất kỳ câu hỏi — ACG tự động kích hoạt.

---

## Cách sử dụng

### Think First Mode (chính)

| Bước | Hành động |
|------|-----------|
| 1 | Gõ câu hỏi vào ChatGPT và bấm **Send** |
| 2 | ACG intercept → overlay 2 cột xuất hiện |
| 3 | Đọc **scaffold kiến thức nền** bên trái |
| 4 | Chọn **knowledge level** của bạn (1–6) từ dropdown |
| 5 | Đọc **3 câu hỏi gợi mở** bên phải và viết câu trả lời |
| 6 | Bấm **"Nộp bài →"** → xem Bloom level và XP earn được |
| 7 | ACG tự động gửi **enriched prompt** đến AI sau 1.9 giây |

### Essay Mode

Khi prompt chứa từ khóa như *viết, soạn, draft, compose* + *bài luận, essay, paragraph*:
- ACG hiển thị 3 câu hỏi capture ý tưởng gốc của bạn
- Bạn viết ideas (không cần hoàn chỉnh)
- AI nhận prompt kèm: *"Viết DỰA TRÊN ý tưởng này..."*

### Bỏ qua (Skip)

Bấm **"Bỏ qua"** để gửi thẳng đến AI — nhưng:
- Streak bị reset về 0
- Dependency Score tăng lên
- Không earn XP

> 💡 **Tip:** Bypass tự động xảy ra với greeting (`hi`, `chào`), câu toán thuần, URL, code snippet — những loại này ACG không intercept.

---

## Công nghệ sử dụng

### Core

| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| Chrome Extension API | Manifest V3 | Extension framework |
| Vanilla JavaScript | ES2022+ | Toàn bộ logic (không framework) |
| CSS Custom Properties | — | Theming và animation |
| Google Fonts — Outfit | 400/600/700/800 | Typography |

### AI / API

| Service | Model | Ghi chú |
|---------|-------|---------|
| [Groq API](https://groq.com) | `llama-3.1-8b-instant` | Primary — 500K TPD free |
| Groq API | `llama3-8b-8192` | Fallback 1 khi rate limited |
| Groq API | `gemma2-9b-it` | Fallback 2 — last resort |

### Storage

| API | Dùng để |
|-----|---------|
| `chrome.storage.local` | Lưu toàn bộ dữ liệu user — local only, không server |

### Không có dependency nào khác — không npm, không build step, không framework.

---

## Kiến trúc kỹ thuật

### Cấu trúc file

```
ai-cognitive-guardian/
├── manifest.json        ← Chrome Extension MV3 config
├── background.js        ← Service worker: Groq API, LRU cache, message router
├── content.js           ← UI overlay, mode detection, intercept send button
├── popup.html           ← Dashboard HTML
├── popup.js             ← Dashboard logic: stats, XP, history
├── popup-styles.css     ← Styles cho overlay + dashboard
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Data Flow

```
User bấm Send
      ↓
content.js intercepts → detectMode(prompt)
      ↓                       ↓                    ↓
  thinkfirst              essay                bypass
      ↓                       ↓                    ↓
showFrameworkStep()    showEssayStep()       gửi thẳng AI
      ↓
GENERATE_FRAMEWORK → background.js → Groq API
      ↓
Render scaffold (trái) + questions (phải)
      ↓
User viết → EVALUATE_ANSWER → Bloom level + XP
      ↓
showScorePanel() → injectAndSubmit(enrichedPrompt) [sau 1.9s]
```

### XP Formula

```
Base       = detectedBloomLevel × 10
Q1         = Base pts
Q2         = Base + 5 pts
Q3         = Base + 10 pts
streakBonus = basePts × 0.2 × min(sessionStreak, 3)
totalEarned = basePts + streakBonus
```

### Bloom's Taxonomy Levels

| Level | Tên | XP Range | Signal nhận biết |
|-------|-----|----------|-----------------|
| 1 ⚪ | Remember | 0–49 XP | Nhắc lại keyword liên quan |
| 2 🔵 | Understand | 50–149 XP | Diễn giải bằng từ của mình, dùng analogy |
| 3 🟢 | Apply | 150–299 XP | Đưa ra ví dụ cụ thể hoặc scenario |
| 4 🟠 | Analyze | 300–499 XP | So sánh 2 thứ, tìm pattern, identify limitation |
| 5 🟣 | Evaluate | 500–799 XP | Judgment có lý do, critique approach |
| 6 🩷 | Create | 800+ XP | Propose solution mới, combine concepts |

---

## Contributing

Pull requests are welcome! Để contribute:

1. Fork repo
2. Tạo branch: `git checkout -b feature/ten-tinh-nang`
3. Commit: `git commit -m 'feat: mô tả ngắn'`
4. Push: `git push origin feature/ten-tinh-nang`
5. Open Pull Request

Xem [CONTRIBUTING.md](CONTRIBUTING.md) để biết thêm convention.

---

## License

Distributed under the **MIT License** — xem [LICENSE](LICENSE) để biết thêm.

---

## Acknowledgments

Dự án này được xây dựng dựa trên nền tảng nghiên cứu và công cụ từ nhiều nguồn:

- **[Bloom's Taxonomy](https://en.wikipedia.org/wiki/Bloom%27s_taxonomy)** — Benjamin Bloom (1956), khung phân loại tư duy 6 bậc là xương sống của toàn bộ hệ thống đánh giá ACG
- **[Groq](https://groq.com)** — inference engine cực nhanh, free tier đủ dùng cho extension, là lý do ACG có thể hoạt động mà không tốn phí người dùng
- **[Meta LLaMA 3](https://llama.meta.com/)** — open-source model chạy trên Groq, đủ mạnh để generate scaffold và evaluate câu trả lời chất lượng cao
- **Stanford HAI & Pew Research** — các nghiên cứu về cognitive offloading và AI dependency là motivation ban đầu cho dự án
- **Microsoft Work Trend Index 2025** — định nghĩa "cognitive offloading" giúp framing vấn đề rõ ràng hơn
- **[Chrome Extension Manifest V3 Docs](https://developer.chrome.com/docs/extensions/mv3/)** — tài liệu chính thức của Google
- **[Outfit Font — Google Fonts](https://fonts.google.com/specimen/Outfit)** — typography làm cho UI trông professional mà không cần design system

---

<p align="center">
  Built with ❤️ for <strong>Hackathon 2025</strong><br/>
  <em>"The goal is not to stop using AI — it's to become someone AI can't replace."</em>
</p>
