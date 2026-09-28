# AI Consent Guardian 🛡️🤖

**Understand Before You Agree.**

AI Consent Guardian is a lightweight, modern full-stack web application designed to help users understand dense Privacy Policies and Terms & Conditions before accepting them. Powered by Google Gemini AI, it automatically detects data collection practices, permissions, third-party data sharing, tracking mechanisms, data retention policies, user rights, red flags, and calculates an overall Privacy Risk Score.

---

## Features

- 📜 **Dual Input Options**: Paste raw policy text OR upload TXT/PDF documents (up to 5 MB).
- 📊 **Privacy Risk Score & Gauge**: Visual 0-100 risk score with color-coded safety badges (Low, Medium, High).
- 🏷️ **Data & Permissions Breakdown**: Identifies specific personal data collected and app permissions required.
- 🚩 **Privacy Red Flags**: Highlights concerning or hostile clauses clearly.
- ✅ **Positive Practices**: Highlights consumer-friendly policies (encryption, deletion rights).
- 💡 **AI Summary & Recommendation**: Simple multi-sentence summary for non-lawyers and a clear recommendation on whether to accept.
- ❓ **Interactive "Ask AI" Panel**: Ask follow-up questions about the document and receive grounded answers.
- 🔒 **Privacy-First Architecture**: Uploaded PDF/TXT documents are processed in-memory / temporarily cleaned up immediately after text extraction.

---

## Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Glassmorphic dark theme, CSS Grid/Flexbox), Vanilla JavaScript (Fetch API).
- **Backend**: Python 3.9+, Flask.
- **AI Integration**: Google Gemini API via `google-genai` / REST fallback.
- **Document Processing**: `pypdf` for PDF text extraction.
- **Environment Management**: `python-dotenv`.

---

## Project Structure

```
AI-Consent-Guardian/
├── app.py
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
├── templates/
│   ├── index.html
│   ├── result.html
│   └── about.html
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── script.js
└── uploads/
    └── .gitkeep
```

---

## Setup & Installation

### 1. Prerequisites

Ensure you have Python 3.9 or higher installed:
```bash
python --version
```

### 2. Clone / Open Workspace

Navigate to the project directory:
```bash
cd AI-Consent-Guardian
```

### 3. Install Dependencies

Install all required Python packages using pip:
```bash
pip install -r requirements.txt
```

### 4. Environment Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Open `.env` and insert your Google Gemini API key (obtained from [Google AI Studio](https://aistudio.google.com/)):
```env
LLM_API_KEY=your_actual_gemini_api_key_here
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=5000
```

---

## How to Run the Project

Start the Flask application server:
```bash
python app.py
```

Open your web browser and navigate to:
```
http://127.0.0.1:5000/
```

---

## How to Use the Application

1. Open **AI Consent Guardian** in your browser.
2. Select **Option A** to paste Privacy Policy text, or **Option B** to upload a PDF or TXT document.
3. Click **"Analyze Policy"**.
4. View your **Privacy Analysis Dashboard**:
   - Check the **Risk Score** and **AI Summary**.
   - Review **Data Collected**, **Permissions**, **Data Sharing**, **Tracking**, **Red Flags**, and **Positive Practices**.
   - Read the **AI Recommendation**.
5. Use the **"Ask about this policy..."** search box to ask specific questions like *"Does this policy sell my location to third parties?"*.
