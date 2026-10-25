# AI Consent Guardian 🛡️🤖

**Understand Before You Agree.**

AI Consent Guardian is a full-stack web application that helps everyday users understand dense Privacy Policies and Terms & Conditions before clicking "I Accept." Powered by Google Gemini AI, it extracts key data practices, detects red flags, calculates a 0–100 Privacy Risk Score, and lets users ask follow-up questions about any policy in plain language.

🔗 **Live Demo:** [https://ai-consent-guardian.vercel.app/](https://ai-consent-guardian.vercel.app/)

---

## What It Does

Most people click "I Agree" without reading privacy policies. AI Consent Guardian changes that by:

- Parsing policy documents and extracting 12 structured data points using Google Gemini AI
- Generating a 0–100 **Privacy Risk Score** with a Low / Medium / High badge
- Highlighting **red flag clauses** and **consumer-friendly provisions** side by side
- Providing a plain-English **summary and recommendation** (Accept / Review Carefully / High Privacy Concern)
- Allowing **natural-language follow-up questions** grounded strictly in the uploaded document

---

## Features

| Feature | Details |
|---|---|
| 📜 **Dual Input** | Paste raw policy text OR upload a `.txt` or `.pdf` file (up to 5 MB) |
| 📊 **Privacy Risk Score** | 0–100 integer score with color-coded badge (Low / Medium / High) |
| 🗂️ **Data Collected** | Lists specific personal data types the policy describes collecting |
| 🔒 **Permissions** | Lists device or app permissions the policy requires |
| 📤 **Third-Party Sharing** | Identifies entities or categories the data is shared with |
| 🎯 **Tracking & Advertising** | Detects cookies, cross-device tracking, ad IDs, and similar mechanisms |
| ⏱️ **Data Retention** | Summarizes how long data is kept |
| ⚖️ **User Rights** | Lists rights such as deletion, data export, and opt-out |
| 🚩 **Red Flags** | Highlights concerning or hostile clauses clearly |
| ✅ **Positive Practices** | Highlights consumer-friendly provisions (encryption, deletion rights, etc.) |
| 💡 **AI Recommendation** | One clear statement on whether to accept the policy |
| ❓ **Ask AI Panel** | Ask follow-up questions; Gemini answers strictly from the document |
| 🔐 **Privacy-First Upload** | Uploaded files are written to `/tmp`, text is extracted, and the file is deleted immediately in a `finally` block — nothing is stored |

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.9+, Flask 3.x |
| **AI Integration** | Google Gemini API via `google-genai` SDK with direct REST fallback |
| **Document Processing** | `pypdf` (PDF text extraction), native file read (TXT) |
| **Frontend** | HTML5, Vanilla CSS3 (CSS Grid, Flexbox, custom properties), Vanilla JavaScript (Fetch API) |
| **Animations** | AOS (Animate On Scroll), Animate.css |
| **Environment** | `python-dotenv` for local development |
| **Deployment** | Vercel (native Python/Flask runtime, static assets via Edge CDN) |

---

## How the System Works

```
User Input (paste text or upload PDF/TXT)
        │
        ▼
Flask /analyze route
        │
        ├─ TXT: read file directly
        └─ PDF: extract text with pypdf
        │
        ▼
Structured prompt sent to Google Gemini API
  (via google-genai SDK → REST fallback if SDK unavailable)
        │
        ▼
Gemini returns JSON with 12 analysis fields
        │
        ▼
Flask validates + defaults missing fields
        │
        ▼
Result rendered in Jinja2 template (result.html)
or returned as JSON for AJAX requests
        │
        ▼
User can ask follow-up questions → /ask route
→ Gemini answers strictly from the document context
```

---

## Gemini AI Integration

The app calls `call_gemini_llm()` which:

1. **Primary:** Uses `google-genai` Python SDK (`genai.Client`) with a priority-ordered list of Gemini Flash models
2. **Fallback:** If the SDK is unavailable or all models fail, retries using direct HTTP POST to the Gemini REST API (`v1beta/models/{model}:generateContent`)

Models attempted in order (fastest/most capable first):
- `gemini-3.5-flash` (primary)
- `gemini-3.6-flash`, `gemini-3.7-flash`, `gemini-3.8-flash`
- `gemini-3.5-flash-lite`, `gemini-2.5-flash-lite` (lite fallbacks)

The analysis prompt instructs Gemini to return **strict raw JSON** with exactly 12 fields. The `clean_json_response()` function strips markdown fences, attempts standard `json.loads()`, and falls back to regex extraction before raising an error.

---

## Privacy Analysis Output

Every analysis returns the following structured fields:

```json
{
  "risk_level": "Low | Medium | High",
  "risk_score": 0,
  "summary": "Plain-English summary...",
  "data_collected": ["Email address", "Device IP", "..."],
  "permissions": ["Location", "Camera (optional)", "..."],
  "data_sharing": ["Third-party ad networks", "..."],
  "tracking_and_advertising": ["Cookies", "Cross-device tracking", "..."],
  "data_retention": "Data is retained indefinitely unless deleted.",
  "user_rights": ["Right to delete account", "Opt-out of marketing", "..."],
  "red_flags": ["Data may be sold to undisclosed affiliates", "..."],
  "positive_points": ["Uses SSL encryption", "..."],
  "recommendation": "Review Carefully — High level of commercial data sharing."
}
```

---

## Project Structure

```
AI-Consent-Guardian/
├── app.py                  # Flask application — routes, Gemini integration, PDF extraction
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── .gitignore              # Excludes .env, __pycache__, uploads/*, etc.
├── README.md
├── templates/              # Jinja2 server-rendered HTML templates
│   ├── index.html          # Homepage with paste/upload form
│   ├── result.html         # Analysis results dashboard
│   └── about.html          # Project information page
├── public/                 # Static assets — served at / by Flask locally
│   ├── css/                # and by Vercel Edge CDN in production
│   │   └── style.css
│   └── js/
│       └── script.js
└── uploads/
    └── .gitkeep            # Placeholder — actual uploads go to /tmp at runtime
```

> **Note on `static/` vs `public/`:** Flask is initialised with `static_folder='public', static_url_path=''` so `/css/style.css` and `/js/script.js` resolve correctly both locally and on Vercel.

---

## Local Setup & Installation

### 1. Prerequisites

Python 3.9 or higher:

```bash
python --version
```

### 2. Clone the Repository

```bash
git clone https://github.com/Sahas-2417/AI-Consent-Guardian.git
cd AI-Consent-Guardian
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and add your Gemini API key (get one free from [Google AI Studio](https://aistudio.google.com/)):

```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

> The app reads `LLM_API_KEY` first, then falls back to `GEMINI_API_KEY`. Either variable name works.

### 5. Run the Development Server

```bash
python app.py
```

Open your browser at:

```
http://127.0.0.1:5000/
```

---

## Deployment on Vercel

The project is deployed using Vercel's **native Python/Flask runtime** with zero additional configuration files.

### How it's set up:

- `app.py` exposes a top-level `app = Flask(...)` instance that Vercel auto-detects
- `requirements.txt` lists all dependencies; Vercel installs them at build time
- `public/` contains static assets — Vercel serves these directly from its Edge CDN at the root URL
- `GEMINI_API_KEY` is set as an **Environment Variable** in the Vercel project dashboard (never committed to the repository)
- Uploaded files are written to `/tmp` (Vercel's only writable path) and deleted immediately after text extraction

### To deploy your own fork:

1. Push the repository to GitHub
2. Import the project into [Vercel](https://vercel.com/)
3. Add `GEMINI_API_KEY` under **Project → Settings → Environment Variables**
4. Deploy — no `vercel.json` required

---

## How to Use

1. Open **AI Consent Guardian** in your browser (locally or at the [live demo](https://ai-consent-guardian.vercel.app/))
2. Choose your input method:
   - **Paste Text** — copy-paste any Privacy Policy or Terms & Conditions text
   - **Upload File** — drag and drop or browse for a `.pdf` or `.txt` file (max 5 MB)
3. Click **"Analyze with AI"**
4. Review your **Privacy Analysis Dashboard**:
   - **Risk Score** — a 0–100 gauge with a Low / Medium / High badge
   - **AI Summary** — plain-English overview
   - **Data Collected, Permissions, Data Sharing, Tracking** — categorised lists
   - **Data Retention & User Rights** — what the policy says about your control
   - **Red Flags** — concerning clauses highlighted
   - **Positive Practices** — consumer-friendly provisions
   - **AI Recommendation** — a clear accept/review/reject directive
5. Use the **"Ask about this policy..."** box to ask specific questions, for example:
   - *"Does this policy allow selling my location to third parties?"*
   - *"Can I request deletion of my account data?"*
   - *"Is my data shared with advertisers?"*

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Homepage — renders the policy input form |
| `GET` | `/about` | About page — project information |
| `POST` | `/analyze` | Accepts form data (text or file upload) or JSON; returns analysis JSON or renders `result.html` |
| `POST` | `/ask` | Accepts JSON `{policy_text, question}`; returns a Gemini-grounded plain-text answer |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | Google Gemini API key from [AI Studio](https://aistudio.google.com/) |
| `LLM_API_KEY` | Optional | Alternative name for the same key — checked first |
| `SECRET_KEY` | Optional | Flask session secret key (a default is used if not set) |
| `PORT` | Optional | Port for local dev server (defaults to `5000`) |

---

## Future Scope

- **URL input mode** — paste a website URL and extract the policy automatically
- **Side-by-side comparison** — compare two policies from different services
- **Historical analysis log** — track how a company's policy changes over time
- **Browser extension** — analyze policies in-context while browsing
- **Multi-language support** — analyze policies written in languages other than English

---

## Disclaimer

AI Consent Guardian provides **informational privacy analysis** using artificial intelligence. The results are generated automatically from the text of the submitted document and are intended to help users understand what they are agreeing to.

This tool **does not constitute formal legal advice**. For legal matters, consult a qualified attorney. The AI may not catch every nuance in a legal document, and its analysis should be treated as a starting point for informed decision-making, not a definitive legal opinion.

---

## License

This project is open source. See the repository for license details.

---

*Built with Python, Flask, and Google Gemini AI · Deployed on Vercel*
