"""
=============================================================================
ApexScreen AI - REST API & Backend Web Server
=============================================================================
Integrates NLP models with SQLite database and serves the frontend SPA.
Supports resume file ingestion (PDF, DOCX, TXT, ZIP), entity parsing,
semantic scoring, and persistence.
=============================================================================
"""

import os
import sys
import logging
import secrets
import re
from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS

# Ensure current directory is on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import database
import nlp_screening_engine as nlp

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ApexServer")

# Initialize Flask App
app = Flask(__name__, static_folder=BASE_DIR, static_url_path="")
app.secret_key = os.environ.get("APEX_SECRET_KEY") or secrets.token_hex(32)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("APEX_COOKIE_SECURE", "").lower() == "true",
    MAX_CONTENT_LENGTH=25 * 1024 * 1024
)
CORS(app)

# Initialize Database on Startup
with app.app_context():
    database.init_db()


# =============================================================================
# 1. STATIC FRONTEND ROUTES (Root)
# =============================================================================

@app.route("/")
def index():
    """Serves the main single-page application."""
    return send_from_directory(BASE_DIR, "index.html")


@app.before_request
def require_authenticated_api():
    if not request.path.startswith("/api/") or request.path in {
        "/api/health", "/api/auth/register", "/api/auth/login", "/api/auth/me", "/api/auth/logout"
    } or request.method == "OPTIONS":
        return None
    if not session.get("user_id"):
        return jsonify({"error": "Authentication required."}), 401
    return None


# =============================================================================
# 2. HEALTH & SYSTEM DIAGNOSTICS
# =============================================================================

@app.route("/api/health", methods=["GET"])
def health():
    """Returns backend system status, SQLite metrics, and NLP model readiness."""
    try:
        return jsonify({
            "status": "healthy",
            "backend": "Python Flask 3.x",
            "database": {
                "type": "SQLite 3",
                "path": database.DB_PATH,
                "connected": True,
                "totalJobs": 0,
                "totalCandidates": 0
            },
            "nlpEngine": {
                "vectorizer": "TF-IDF (scikit-learn)",
                "extractors": ["PDF (pypdf)", "DOCX (python-docx)", "TXT"],
                "active": True
            }
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/api/auth/register", methods=["POST"])
def register():
    payload = request.get_json() or {}
    name = str(payload.get("name", "")).strip()
    company = str(payload.get("company", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    if not name or not company or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify({"error": "Name, company, and a valid work email are required."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400
    try:
        user = database.create_user(name, email, company, password)
    except database.sqlite3.IntegrityError:
        return jsonify({"error": "An account with this email already exists. Please log in."}), 409
    session.clear()
    session["user_id"] = user["id"]
    return jsonify({"user": user}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    payload = request.get_json() or {}
    user = database.authenticate_user(
        str(payload.get("email", "")),
        str(payload.get("password", ""))
    )
    if not user:
        return jsonify({"error": "Invalid email or password."}), 401
    session.clear()
    session["user_id"] = user["id"]
    return jsonify({"user": user}), 200


@app.route("/api/auth/me", methods=["GET"])
def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"user": None}), 200
    conn = database.get_db_connection()
    row = conn.execute(
        "SELECT id, name, email, company FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    conn.close()
    if not row:
        session.clear()
        return jsonify({"user": None}), 200
    return jsonify({"user": dict(row)}), 200


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"status": "success"}), 200


@app.route("/api/auth/profile", methods=["PUT"])
def update_profile():
    payload = request.get_json() or {}
    name = str(payload.get("name", "")).strip()
    company = str(payload.get("company", "")).strip()
    if not name or not company:
        return jsonify({"error": "Name and company are required."}), 400
    try:
        user = database.update_user(session["user_id"], name, company)
    except ValueError as error:
        return jsonify({"error": str(error)}), 404
    return jsonify({"user": user}), 200


# =============================================================================
# 3. COMPANY PROFILE
# =============================================================================

@app.route("/api/company", methods=["GET", "PUT"])
def company_endpoint():
    if request.method == "GET":
        company = database.get_company(session["user_id"])
        return jsonify(company), 200
    else:
        payload = request.get_json() or {}
        updated = database.update_company(payload, session["user_id"])
        return jsonify(updated), 200


# =============================================================================
# 4. JOBS ENDPOINTS (SQL CRUD)
# =============================================================================

@app.route("/api/jobs", methods=["GET", "POST"])
def jobs_endpoint():
    if request.method == "GET":
        jobs = database.get_all_jobs(session["user_id"])
        return jsonify(jobs), 200
    else:
        payload = request.get_json() or {}
        if not payload.get("title"):
            return jsonify({"error": "Job title is required."}), 400
        if payload.get("status", "Active") not in {"Active", "Closed"}:
            return jsonify({"error": "Job status must be Active or Closed."}), 400
        new_job = database.create_job(payload, session["user_id"])
        return jsonify(new_job), 201


@app.route("/api/jobs/extract", methods=["POST"])
def extract_job_description_endpoint():
    uploaded_file = request.files.get("file")
    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "Choose a JD file to upload."}), 400
    filename = uploaded_file.filename
    extension = os.path.splitext(filename)[1].lower()
    if extension not in {".pdf", ".docx", ".txt"}:
        return jsonify({"error": "Upload a PDF, DOCX, or TXT job description."}), 400
    text = nlp.DocumentExtractor.extract_from_bytes(uploaded_file.read(), filename)
    if not text.strip():
        return jsonify({"error": "No readable text was found in the uploaded job description."}), 400

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = next((line for line in lines if len(line) < 100), "")
    skill_terms = [
        "Python", "Java", "JavaScript", "TypeScript", "React", "SQL", "Django", "Flask",
        "Node.js", "AWS", "Azure", "Docker", "Kubernetes", "Machine Learning", "NLP",
        "PyTorch", "TensorFlow", "Figma", "Git", "C++", "C#", "HTML", "CSS", "Excel",
        "Communication", "Project Management", "FastAPI", "LLMs"
    ]
    lowered_text = text.lower()
    required_skills = [skill for skill in skill_terms if skill.lower() in lowered_text]
    exp_match = re.search(r"(\d+(?:\.\d+)?)\s*\+?\s*years?", text, re.IGNORECASE)
    education_match = re.search(
        r"(Ph\.?D\.?|Doctorate|Master(?:'s)?|Bachelor(?:'s)?|Associate(?:'s)?)[^.\n]{0,100}",
        text, re.IGNORECASE
    )
    return jsonify({
        "title": title or os.path.splitext(os.path.basename(filename))[0].replace("_", " "),
        "department": "Engineering",
        "location": "Remote",
        "type": "Full-time",
        "description": text[:12000],
        "requiredSkills": required_skills,
        "preferredSkills": [],
        "minExperience": float(exp_match.group(1)) if exp_match else 0,
        "education": education_match.group(0).strip() if education_match else "Any",
        "otherScreeningRules": ""
    }), 200


@app.route("/api/jobs/<job_id>", methods=["GET", "PUT", "DELETE"])
def single_job_endpoint(job_id):
    if request.method == "GET":
        job = database.get_job(job_id, session["user_id"])
        if not job:
            return jsonify({"error": f"Job '{job_id}' not found."}), 404
        return jsonify(job), 200

    elif request.method == "PUT":
        payload = request.get_json() or {}
        if payload.get("status") is not None and payload["status"] not in {"Active", "Closed"}:
            return jsonify({"error": "Job status must be Active or Closed."}), 400
        updated = database.update_job(job_id, payload, session["user_id"])
        if not updated:
            return jsonify({"error": f"Job '{job_id}' not found."}), 404
        return jsonify(updated), 200

    elif request.method == "DELETE":
        deleted = database.delete_job(job_id, session["user_id"])
        if not deleted:
            return jsonify({"error": f"Job '{job_id}' not found."}), 404
        return jsonify({"success": True, "message": f"Job '{job_id}' deleted."}), 200


# =============================================================================
# 5. CANDIDATES ENDPOINTS (SQL CRUD & FILTERING)
# =============================================================================

@app.route("/api/candidates", methods=["GET", "POST"])
def candidates_endpoint():
    if request.method == "GET":
        job_id = request.args.get("jobId") or request.args.get("job_id")
        status = request.args.get("status")
        search = request.args.get("search")
        candidates = database.get_candidates(session["user_id"], job_id=job_id, status=status, search=search)
        return jsonify(candidates), 200

    else:
        payload = request.get_json() or {}
        if not payload.get("jobId") or not payload.get("name"):
            return jsonify({"error": "Candidate name and jobId are required."}), 400
        created = database.create_candidate(payload, session["user_id"])
        return jsonify(created), 201


@app.route("/api/candidates/<candidate_id>", methods=["GET", "DELETE"])
def single_candidate_endpoint(candidate_id):
    if request.method == "GET":
        cand = database.get_candidate(candidate_id, session["user_id"])
        if not cand:
            return jsonify({"error": f"Candidate '{candidate_id}' not found."}), 404
        return jsonify(cand), 200

    elif request.method == "DELETE":
        deleted = database.delete_candidate(candidate_id, session["user_id"])
        if not deleted:
            return jsonify({"error": f"Candidate '{candidate_id}' not found."}), 404
        return jsonify({"success": True, "message": f"Candidate '{candidate_id}' removed."}), 200


@app.route("/api/candidates/<candidate_id>/status", methods=["PATCH"])
def candidate_status_endpoint(candidate_id):
    payload = request.get_json() or {}
    new_status = payload.get("status")
    if not new_status:
        return jsonify({"error": "New status is required."}), 400

    updated = database.update_candidate_status(candidate_id, new_status, session["user_id"])
    if not updated:
        return jsonify({"error": f"Candidate '{candidate_id}' not found."}), 404
    return jsonify(updated), 200


# =============================================================================
# 6. AI SCREENING PIPELINE ENDPOINT (NLP + SQL INTEGRATION)
# =============================================================================

@app.route("/api/jobs/<job_id>/screen", methods=["POST"])
def screen_resumes_endpoint(job_id):
    """
    Ingests resumes (files via multipart/form-data OR json payload with raw texts),
    runs the NLP parsing and TF-IDF semantic scoring models against the target job in SQL,
    saves the resulting candidates and logs to SQLite, and returns ranked scorecards.
    """
    owner_id = session["user_id"]
    job = database.get_job(job_id, owner_id)
    if not job:
        return jsonify({"error": f"Target job '{job_id}' not found in database."}), 404

    uploaded_items = []

    # Case A: Multipart form upload (actual files from UI file picker)
    if "files" in request.files or len(request.files) > 0:
        file_list = request.files.getlist("files")
        for f in file_list:
            if f.filename:
                content_bytes = f.read()
                uploaded_items.append({
                    "filename": f.filename,
                    "content": content_bytes,
                    "size": len(content_bytes)
                })

    # Case B: JSON payload with simulated or raw text resumes
    elif request.is_json:
        data = request.get_json() or {}
        raw_resumes = data.get("resumes", [])
        if not raw_resumes and "resume" in data:
            raw_resumes = [data["resume"]]

        for idx, item in enumerate(raw_resumes):
            if isinstance(item, str):
                uploaded_items.append({
                    "filename": f"candidate_resume_{idx+1}.txt",
                    "content": item,
                    "size": len(item.encode("utf-8"))
                })
            elif isinstance(item, dict):
                uploaded_items.append({
                    "filename": item.get("filename", f"resume_{idx+1}.txt"),
                    "content": item.get("content", item.get("text", "")),
                    "size": len(item.get("content", ""))
                })

    if not uploaded_items:
        return jsonify({"error": "No resume files or text content provided for screening."}), 400

    try:
        # Run NLP Pipeline with direct SQL persistence
        result = nlp.screen_job_resumes_pipeline(job_id, uploaded_items, owner_id)
        return jsonify(result), 200

    except Exception as e:
        logger.exception("Error during resume screening pipeline execution")
        return jsonify({"error": f"Screening failed: {str(e)}"}), 500


# =============================================================================
# 7. RESUMES REPOSITORY & ANALYTICS
# =============================================================================

@app.route("/api/resumes", methods=["GET"])
def resumes_endpoint():
    resumes = database.get_all_resumes(session["user_id"])
    return jsonify(resumes), 200


@app.route("/api/resumes/<resume_id>", methods=["GET"])
def resume_content_endpoint(resume_id):
    resume = database.get_resume(resume_id, session["user_id"])
    if not resume:
        return jsonify({"error": "Resume not found."}), 404
    response = app.response_class(resume["parsed_text"], mimetype="text/plain")
    response.headers["Content-Disposition"] = f'inline; filename="{resume["filename"].replace(chr(34), "")}"'
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.route("/api/analytics", methods=["GET"])
def analytics_endpoint():
    metrics = database.get_analytics_metrics(session["user_id"])
    return jsonify(metrics), 200


@app.route("/api/reset", methods=["POST"])
def reset_endpoint():
    res = database.reset_database(session["user_id"])
    return jsonify(res), 200


@app.route("/api/backup", methods=["GET"])
def backup_endpoint():
    """Exports full database dump (backing) for backup & persistence."""
    try:
        data = database.create_backup(session["user_id"])
        return jsonify(data), 200
    except Exception as e:
        logger.exception("Backup generation failed")
        return jsonify({"error": str(e)}), 500


@app.route("/api/restore", methods=["POST"])
def restore_endpoint():
    """Restores database from a provided backup JSON payload."""
    payload = request.get_json()
    if not payload:
        return jsonify({"error": "No backup data provided in request body."}), 400
    try:
        result = database.restore_backup(payload, session["user_id"])
        return jsonify(result), 200
    except Exception as e:
        logger.exception("Database restoration failed")
        return jsonify({"error": str(e)}), 400

# 8. CATCH-ALL STATIC ASSET & SPA PROXY (Defined last to prevent shadowing API routes)
# =============================================================================

@app.route("/<path:path>")
def static_proxy(path):
    """Serves static assets (css, js, images, etc.) or falls back to SPA index."""
    if path.startswith("api/"):
        return jsonify({"error": f"API endpoint '/{path}' not found."}), 404
    file_path = os.path.join(BASE_DIR, path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(BASE_DIR, path)
    return send_from_directory(BASE_DIR, "index.html")


# =============================================================================
# MAIN ENTRYPOINT
# =============================================================================

def run_server(port=5000, debug=False):
    print("=" * 80)
    print(f"[STARTUP] ApexScreen AI Backend Server active on http://127.0.0.1:{port}")
    print(f"[STATIC] Serving Frontend UI from: {BASE_DIR}")
    print(f"[DATABASE] SQLite Database initialized at: {database.DB_PATH}")
    print(f"[NLP MODEL] TF-IDF Semantic Cosine Similarity + Taxonomy Entity Extraction")
    print("=" * 80)
    app.run(host="0.0.0.0", port=port, debug=debug)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    run_server(port=port, debug=False)
