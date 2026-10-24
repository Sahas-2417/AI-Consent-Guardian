import os
import re
import json
import logging
from flask import Flask, render_template, request, jsonify, flash, redirect, url_for
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "ai-consent-guardian-secret-key-2026")

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
ALLOWED_EXTENSIONS = {'txt', 'pdf'}
MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB limit

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# API Keys Configuration
LLM_API_KEY = os.getenv("LLM_API_KEY") or os.getenv("GEMINI_API_KEY") or ""

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_file(file_path, filename):
    """Extract text content from uploaded TXT or PDF file."""
    ext = filename.rsplit('.', 1)[1].lower()
    
    if ext == 'txt':
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
            return text.strip()
        except Exception as e:
            logger.error(f"Error reading TXT file: {e}")
            raise ValueError("Could not read text file. Please ensure it is a valid UTF-8 encoded text document.")
            
    elif ext == 'pdf':
        try:
            # Try pypdf first
            import pypdf
            reader = pypdf.PdfReader(file_path)
            text_pages = []
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text_pages.append(extracted)
            full_text = "\n".join(text_pages).strip()
            
            if not full_text:
                raise ValueError("The uploaded PDF appears to be empty or contains scanned images without extractable text.")
            return full_text
            
        except ImportError:
            # Fallback to PyPDF2 if pypdf is unavailable
            try:
                import PyPDF2
                with open(file_path, 'rb') as f:
                    reader = PyPDF2.PdfReader(f)
                    text_pages = [page.extract_text() for page in reader.pages if page.extract_text()]
                    full_text = "\n".join(text_pages).strip()
                if not full_text:
                    raise ValueError("The uploaded PDF contains no extractable text.")
                return full_text
            except Exception as e:
                logger.error(f"Error extracting PDF text with PyPDF2: {e}")
                raise ValueError("Failed to extract text from PDF document.")
        except Exception as e:
            logger.error(f"Error extracting PDF text: {e}")
            raise ValueError(f"Could not parse PDF file: {str(e)}")
            
    else:
        raise ValueError("Unsupported file format. Please upload a TXT or PDF file.")

def call_gemini_llm(prompt_text, api_key):
    """Call Google Gemini API using google-genai SDK with REST fallback."""
    if not api_key:
        raise ValueError("API key for LLM is missing. Please set LLM_API_KEY or GEMINI_API_KEY in your .env file.")

    # Models confirmed available via ListModels API (prioritized by speed/capability)
    MODELS_TO_TRY = [
        "gemini-3.5-flash",       # PRIMARY: confirmed working ✓
        "gemini-3.6-flash",       # Newer generation flash
        "gemini-3.7-flash",       # Newer generation flash
        "gemini-3.8-flash",       # Latest flash (may have high demand)
        "gemini-3.5-flash-lite",  # Lite fallback
        "gemini-2.5-flash-lite",  # Lite fallback v2
    ]

    # Method 1: Try google.genai SDK (recommended)
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        for model_name in MODELS_TO_TRY:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt_text
                )
                if response and response.text:
                    logger.info(f"Gemini API success via google.genai SDK using model: {model_name}")
                    return response.text
            except Exception as model_err:
                logger.warning(f"Model {model_name} failed via google.genai: {model_err}")
                continue
    except ImportError:
        logger.warning("google.genai SDK not available, falling back to REST API")
    except Exception as e:
        logger.warning(f"google.genai SDK call failed, trying REST fallback: {e}")

    # Method 2: HTTP REST requests to Gemini API (direct fallback)
    import requests
    last_err = None

    for model_name in MODELS_TO_TRY:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt_text}]
                }
            ]
        }
        try:
            res = requests.post(url, headers=headers, json=payload, timeout=60)
            if res.status_code == 200:
                data = res.json()
                text = data['candidates'][0]['content']['parts'][0]['text']
                logger.info(f"Gemini API success via REST using model: {model_name}")
                return text
            else:
                last_err = f"Model {model_name} - API status {res.status_code}: {res.text[:300]}"
                logger.warning(last_err)
        except Exception as ex:
            last_err = str(ex)
            logger.warning(f"REST request failed for model {model_name}: {ex}")

    raise RuntimeError(f"Failed to communicate with Gemini API after trying all models: {last_err}")

def clean_json_response(raw_text):
    """Safely extract and parse JSON object from LLM raw text output."""
    if not raw_text:
        raise ValueError("Empty response received from AI model.")

    # Remove markdown code block fences if present
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r"\n?```$", "", cleaned, flags=re.MULTILINE).strip()

    # Try standard json parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Search for first '{' and last '}'
        match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
        
        # If parsing still fails, construct a safe fallback object
        logger.error(f"Failed to parse JSON from response: {raw_text[:200]}")
        raise ValueError("The AI model returned an unparseable response. Please try again.")

def analyze_policy_with_ai(policy_text):
    """Send policy text to LLM with structured evaluation prompt."""
    prompt = f"""You are a privacy and cybersecurity analysis assistant.
Analyze the following Privacy Policy or Terms and Conditions text.

Identify:
1. Overall privacy risk level (Low, Medium, or High)
2. Risk score (0 to 100 integer, where 0 is completely safe/respectful and 100 is high risk/hostile)
3. Simple overall explanation (summary for non-lawyers)
4. Data collected (list of data types)
5. User permissions (list of device/app permissions required)
6. Third-party data sharing (list of entities or categories data is shared with)
7. Advertising & tracking practices (list of tracking mechanisms like cookies, cross-site, ad IDs)
8. Data retention policy (brief summary statement)
9. User rights (list of rights like deletion, export, opt-out)
10. Red flags / concerning clauses (list of worrisome points)
11. Positive privacy practices (list of consumer-friendly provisions)
12. Recommendation (clear advice statement like "Accept with Awareness", "Review Carefully", "High Privacy Concern")

CRITICAL RULES:
- Do NOT invent information.
- Only report information that can reasonably be supported by the provided document.
- If something is not mentioned in the policy, explicitly state "Not clearly mentioned".
- Return the response strictly as valid raw JSON without extra conversational text.

Return JSON in this EXACT structure:
{{
  "risk_level": "Low" | "Medium" | "High",
  "risk_score": 75,
  "summary": "Clear multi-sentence summary for a general user...",
  "data_collected": ["Email address", "Device IP", "Location data"],
  "permissions": ["Location", "Camera (optional)"],
  "data_sharing": ["Third-party ad networks", "Analytics providers"],
  "tracking_and_advertising": ["Cookies used for targeted ads", "Cross-device tracking"],
  "data_retention": "Data is retained indefinitely unless account deletion is requested.",
  "user_rights": ["Right to delete account data", "Opt-out of marketing emails"],
  "red_flags": ["Data may be sold to undisclosed affiliates", "Policy can change without prior notice"],
  "positive_points": ["Uses SSL encryption", "Provides explicit opt-out links"],
  "recommendation": "Review Carefully — High level of commercial data sharing."
}}

Document Text to Analyze:
---
{policy_text[:40000]}
---
"""
    raw_response = call_gemini_llm(prompt, LLM_API_KEY)
    result_json = clean_json_response(raw_response)
    
    # Ensure default fields exist
    defaults = {
        "risk_level": "Medium",
        "risk_score": 50,
        "summary": "Analysis completed.",
        "data_collected": [],
        "permissions": [],
        "data_sharing": [],
        "tracking_and_advertising": [],
        "data_retention": "Not clearly mentioned",
        "user_rights": [],
        "red_flags": [],
        "positive_points": [],
        "recommendation": "Review Carefully"
    }
    for key, val in defaults.items():
        if key not in result_json or result_json[key] is None:
            result_json[key] = val

    return result_json


# --- ROUTES ---

@app.route('/')
def index():
    """Render main homepage with policy input form."""
    return render_template('index.html')

@app.route('/about')
def about():
    """Render About page."""
    return render_template('about.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    """Handle policy analysis for text input or uploaded document."""
    extracted_text = ""
    
    # Check if request is JSON or Multipart Form
    if request.is_json:
        req_data = request.get_json() or {}
        extracted_text = req_data.get('policy_text', '').strip()
    else:
        # Check pasted text
        pasted_text = request.form.get('policy_text', '').strip()
        
        # Check file upload
        uploaded_file = request.files.get('file')
        
        if uploaded_file and uploaded_file.filename != '':
            if not allowed_file(uploaded_file.filename):
                msg = "Invalid file type. Only .txt and .pdf files are supported."
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 'application/json' in request.headers.get('Accept', ''):
                    return jsonify({'error': msg}), 400
                flash(msg, 'danger')
                return redirect(url_for('index'))
                
            filename = secure_filename(uploaded_file.filename)
            temp_filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            try:
                uploaded_file.save(temp_filepath)
                extracted_text = extract_text_from_file(temp_filepath, filename)
            except ValueError as ve:
                msg = str(ve)
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 'application/json' in request.headers.get('Accept', ''):
                    return jsonify({'error': msg}), 400
                flash(msg, 'danger')
                return redirect(url_for('index'))
            except Exception as e:
                logger.error(f"Upload error: {e}")
                msg = "Failed to process the uploaded file."
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 'application/json' in request.headers.get('Accept', ''):
                    return jsonify({'error': msg}), 400
                flash(msg, 'danger')
                return redirect(url_for('index'))
            finally:
                # Always remove temp file after text extraction
                if os.path.exists(temp_filepath):
                    try:
                        os.remove(temp_filepath)
                    except Exception:
                        pass
        elif pasted_text:
            extracted_text = pasted_text

    # Validation
    if not extracted_text or len(extracted_text) < 30:
        msg = "Please paste a privacy policy or upload a TXT/PDF file containing at least 30 characters."
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 'application/json' in request.headers.get('Accept', ''):
            return jsonify({'error': msg}), 400
        flash(msg, 'danger')
        return redirect(url_for('index'))

    # Check API key configuration
    if not LLM_API_KEY:
        msg = "API key is missing! Please configure LLM_API_KEY or GEMINI_API_KEY in your .env file."
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 'application/json' in request.headers.get('Accept', ''):
            return jsonify({'error': msg}), 500
        flash(msg, 'danger')
        return redirect(url_for('index'))

    # Perform AI Analysis
    try:
        analysis_result = analyze_policy_with_ai(extracted_text)
        
        # If AJAX request, return JSON
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 'application/json' in request.headers.get('Accept', ''):
            return jsonify({
                'success': True,
                'data': analysis_result,
                'raw_text_length': len(extracted_text)
            })
            
        # Otherwise render result.html directly
        return render_template('result.html', analysis=analysis_result, policy_text=extracted_text)
        
    except ValueError as ve:
        msg = str(ve)
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 'application/json' in request.headers.get('Accept', ''):
            return jsonify({'error': msg}), 400
        flash(msg, 'danger')
        return redirect(url_for('index'))
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        msg = f"An error occurred while analyzing the document with AI: {str(e)}"
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 'application/json' in request.headers.get('Accept', ''):
            return jsonify({'error': msg}), 500
        flash(msg, 'danger')
        return redirect(url_for('index'))

@app.route('/ask', methods=['POST'])
def ask():
    """Handle follow-up questions about the analyzed policy."""
    data = request.get_json() or {}
    policy_text = data.get('policy_text', '').strip()
    question = data.get('question', '').strip()
    
    if not question:
        return jsonify({'error': "Please enter a question."}), 400
        
    if not policy_text:
        return jsonify({'error': "No policy text context found. Please analyze a policy first."}), 400
        
    if not LLM_API_KEY:
        return jsonify({'error': "API key missing in environment variables."}), 500
        
    prompt = f"""You are a specialized AI privacy assistant.
Below is the text of a Privacy Policy or Terms & Conditions document:

---
{policy_text[:35000]}
---

User Question: "{question}"

Instructions:
- Provide a direct, concise, and easy-to-understand answer to the question based ONLY on the provided policy document.
- Do NOT invent information or assume facts not present in the document.
- If the policy does not address the question, explicitly state: "This policy does not explicitly mention or detail this topic."
- Do NOT give legal advice. Keep your response helpful and neutral.
"""

    try:
        answer = call_gemini_llm(prompt, LLM_API_KEY)
        return jsonify({'success': True, 'answer': answer.strip()})
    except Exception as e:
        logger.error(f"Ask AI error: {e}")
        return jsonify({'error': f"Failed to get AI answer: {str(e)}"}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
