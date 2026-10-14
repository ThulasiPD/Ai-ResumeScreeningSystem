"""
=============================================================================
ApexScreen AI - SQLite Database Model & Data Access Layer
=============================================================================
Manages SQL schemas, seed data initialization, transactions,
and parameterized queries for Companies, Jobs, Candidates, and Resumes.
=============================================================================
"""

import os
import json
import sqlite3
import logging
import hashlib
import hmac
import secrets
from typing import List, Dict, Any, Optional

logger = logging.getLogger("ApexDB")

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "apex_screening.db")


def get_db_connection() -> sqlite3.Connection:
    """Creates a thread-safe connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(force_reseed: bool = False):
    """Initializes tables and seeds initial data if database is empty or reseed requested."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if force_reseed:
        cursor.execute("DROP TABLE IF EXISTS users")
        cursor.execute("DROP TABLE IF EXISTS candidates")
        cursor.execute("DROP TABLE IF EXISTS resumes")
        cursor.execute("DROP TABLE IF EXISTS jobs")
        cursor.execute("DROP TABLE IF EXISTS companies")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            company TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 1. Companies Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            domain TEXT,
            size TEXT,
            industry TEXT,
            plan TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2. Jobs Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            department TEXT NOT NULL,
            location TEXT,
            type TEXT DEFAULT 'Full-time',
            created_date TEXT,
            status TEXT DEFAULT 'Active',
            applicants_count INTEGER DEFAULT 0,
            description TEXT,
            required_skills TEXT,     -- JSON array
            preferred_skills TEXT,    -- JSON array
            min_experience REAL DEFAULT 0,
            education TEXT,
            other_screening_rules TEXT,
            weights TEXT,             -- JSON dict
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 3. Candidates Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS candidates (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            match_score INTEGER DEFAULT 0,
            skills_match_score INTEGER DEFAULT 0,
            experience_match_score INTEGER DEFAULT 0,
            education_match_score INTEGER DEFAULT 0,
            status TEXT DEFAULT 'Under Review', -- 'Shortlisted', 'Under Review', 'Rejected'
            skills TEXT,               -- JSON array
            matching_skills TEXT,      -- JSON array
            missing_skills TEXT,       -- JSON array
            education TEXT,
            experience_years REAL DEFAULT 0,
            experience_details TEXT,   -- JSON array of dicts
            projects TEXT,             -- JSON array
            certifications TEXT,       -- JSON array
            ai_screening_explanation TEXT,
            resume_filename TEXT,
            raw_text TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
        )
    """)

    # 4. Uploaded Resumes Repository
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS resumes (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            file_type TEXT,
            file_size INTEGER,
            candidate_id TEXT,
            job_id TEXT,
            parsed_text TEXT,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL,
            FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
        )
    """)

    for table in ("companies", "jobs", "candidates", "resumes"):
        columns = {row["name"] for row in cursor.execute(f"PRAGMA table_info({table})")}
        if "owner_id" not in columns:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN owner_id TEXT")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_owner_id ON jobs(owner_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_candidates_owner_id ON candidates(owner_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_resumes_owner_id ON resumes(owner_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id)")

    # Create indexes for high-speed queries
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_candidates_job_id ON candidates(job_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_candidates_score ON candidates(match_score DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)")

    conn.commit()

    # Check if empty, then seed
    cursor.execute("SELECT COUNT(*) AS cnt FROM jobs")
    job_count = cursor.fetchone()["cnt"]

    if job_count == 0 or force_reseed:
        seed_data(conn)

    conn.close()
    logger.info("Database initialized successfully at: %s", DB_PATH)


def _password_digest(password: str, salt: Optional[bytes] = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310_000)
    return f"{salt.hex()}:{digest.hex()}"


def create_user(name: str, email: str, company: str, password: str) -> Dict[str, Any]:
    user_id = secrets.token_hex(16)
    normalized_email = email.strip().lower()
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO users (id, name, email, company, password_hash) VALUES (?, ?, ?, ?, ?)",
            (user_id, name.strip(), normalized_email, company.strip(), _password_digest(password))
        )
        conn.execute(
            """INSERT INTO companies (id, name, domain, size, industry, plan, owner_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                f"comp_{user_id[:12]}", company.strip(), normalized_email.split("@")[-1],
                "", "", "Starter", user_id
            )
        )
        conn.commit()
        return {"id": user_id, "name": name.strip(), "email": normalized_email, "company": company.strip()}
    finally:
        conn.close()


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT id, name, email, company, password_hash FROM users WHERE email = ? COLLATE NOCASE",
            (email.strip(),)
        ).fetchone()
        if not row:
            return None
        salt_hex, expected_hex = row["password_hash"].split(":", 1)
        actual = _password_digest(password, bytes.fromhex(salt_hex)).split(":", 1)[1]
        if not hmac.compare_digest(actual, expected_hex):
            return None
        return {"id": row["id"], "name": row["name"], "email": row["email"], "company": row["company"]}
    finally:
        conn.close()


def update_user(user_id: str, name: str, company: str) -> Dict[str, Any]:
    conn = get_db_connection()
    conn.execute("UPDATE users SET name = ?, company = ? WHERE id = ?", (name.strip(), company.strip(), user_id))
    conn.execute("UPDATE companies SET name = ? WHERE owner_id = ?", (company.strip(), user_id))
    conn.commit()
    row = conn.execute(
        "SELECT id, name, email, company FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    conn.close()
    if not row:
        raise ValueError("User account not found.")
    return dict(row)


def seed_data(conn: sqlite3.Connection):
    """Populates database with initial rich enterprise data."""
    cursor = conn.cursor()

    # Initial Company
    cursor.execute("""
        INSERT OR REPLACE INTO companies (id, name, domain, size, industry, plan)
        VALUES (?, ?, ?, ?, ?, ?)
    """, ("comp_01", "Apex AI Solutions", "apexai.com", "50-100", "Software & Technology", "Enterprise Pro"))

    # Initial Jobs
    initial_jobs = [
        {
            "id": "job_01",
            "title": "Senior AI/ML Engineer",
            "department": "Engineering",
            "location": "San Francisco, CA (Hybrid)",
            "type": "Full-time",
            "createdDate": "2026-08-10",
            "status": "Active",
            "applicantsCount": 6,
            "description": "We are looking for a Senior AI/ML Engineer to build and scale our conversational AI pipelines. You will design, train, and deploy deep learning models, particularly large language models (LLMs), and integrate them into production cloud APIs.",
            "requirements": {
                "requiredSkills": ["Python", "PyTorch", "Transformers", "LLMs", "NLP", "Docker", "AWS"],
                "preferredSkills": ["Kubernetes", "LangChain", "Vector Databases", "FastAPI"],
                "minExperience": 5,
                "education": "Master's or Ph.D. in Computer Science, Data Science, or related field",
                "otherScreeningRules": "Must have experience deploying models to production with AWS/Docker."
            }
        },
        {
            "id": "job_02",
            "title": "Lead React Developer",
            "department": "Frontend",
            "location": "Remote (US)",
            "type": "Full-time",
            "createdDate": "2026-08-15",
            "status": "Active",
            "applicantsCount": 4,
            "description": "Looking for a seasoned Frontend Engineer with deep React expertise. You will own the UI/UX architecture of our flagship recruiter workspace, optimize client-side performance, and mentor a small team of frontend developers.",
            "requirements": {
                "requiredSkills": ["React", "JavaScript", "TypeScript", "HTML5/CSS3", "Redux Toolkit", "Webpack"],
                "preferredSkills": ["Next.js", "Tailwind CSS", "Bootstrap", "Jest/Cypress"],
                "minExperience": 6,
                "education": "Bachelor's in Computer Science or equivalent experience",
                "otherScreeningRules": "Strong focus on state management and performance tuning."
            }
        },
        {
            "id": "job_03",
            "title": "Product Designer (UI/UX)",
            "department": "Design",
            "location": "New York, NY (On-site)",
            "type": "Contract",
            "createdDate": "2026-08-18",
            "status": "Active",
            "applicantsCount": 3,
            "description": "Join us to shape the future of enterprise SaaS recruitment tools. You will lead user research, wireframe user flows, design high-fidelity components, and work closely with frontend engineers to deliver a cohesive product experience.",
            "requirements": {
                "requiredSkills": ["Figma", "UI/UX Design", "Wireframing", "Prototyping", "Design Systems"],
                "preferredSkills": ["Webflow", "Adobe Creative Suite", "Usability Testing", "Basic HTML/CSS"],
                "minExperience": 4,
                "education": "Bachelor's in Design, HCI, or related field",
                "otherScreeningRules": "Portfolio required demonstrating shipped SaaS products."
            }
        }
    ]

    for j in initial_jobs:
        req = j.get("requirements", {})
        cursor.execute("""
            INSERT OR REPLACE INTO jobs 
            (id, title, department, location, type, created_date, status, applicants_count, description, required_skills, preferred_skills, min_experience, education, other_screening_rules, weights)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            j["id"],
            j["title"],
            j["department"],
            j.get("location", ""),
            j.get("type", "Full-time"),
            j.get("createdDate", "2026-08-10"),
            j.get("status", "Active"),
            j.get("applicantsCount", 0),
            j.get("description", ""),
            json.dumps(req.get("requiredSkills", [])),
            json.dumps(req.get("preferredSkills", [])),
            float(req.get("minExperience", 0)),
            req.get("education", ""),
            req.get("otherScreeningRules", ""),
            json.dumps({"skills": 0.45, "experience": 0.35, "education": 0.20})
        ))

    # Initial Candidates
    initial_candidates = [
        # Job 01
        {
            "id": "cand_101",
            "jobId": "job_01",
            "name": "Dr. Aris Thorne",
            "email": "aris.thorne@mlresearch.io",
            "phone": "+1 (555) 321-7890",
            "matchScore": 95,
            "skillsMatchScore": 98,
            "experienceMatchScore": 95,
            "educationMatchScore": 90,
            "status": "Shortlisted",
            "skills": ["Python", "PyTorch", "Transformers", "LLMs", "NLP", "Docker", "AWS", "Kubernetes", "Vector Databases", "FastAPI", "C++"],
            "matchingSkills": ["Python", "PyTorch", "Transformers", "LLMs", "NLP", "Docker", "AWS", "Kubernetes", "Vector Databases", "FastAPI"],
            "missingSkills": [],
            "education": "Ph.D. in Computer Science (Specialization in NLP) - Stanford University",
            "experienceYears": 6,
            "experienceDetails": [
                {"role": "Senior ML Engineer", "company": "NeuralFlow Labs", "years": "3 years", "desc": "Designed and optimized transformer-based LLMs. Built vector indexes for semantic search and reduced model inference latency by 40%."},
                {"role": "AI Research Scientist", "company": "Cognitive Labs", "years": "3 years", "desc": "Researched deep generative architectures, published at NeurIPS, and engineered containerized training runs on AWS cluster nodes."}
            ],
            "projects": ["DocuMind: Open-source document QA chatbot", "FastGen: Low-latency inference engine for transformers"],
            "certifications": ["AWS Certified Machine Learning - Specialty", "DeepLearning.AI Tensorflow Developer Certificate"],
            "aiScreeningExplanation": "Dr. Thorne is an exceptional fit. He holds a Ph.D. directly focusing on NLP from Stanford and demonstrates over 6 years of robust ML engineering experience. He possesses 100% of the required technical stack, including Docker, AWS, and PyTorch, and matches advanced preferred skills such as Vector Databases and FastAPI. Strong recommendation for immediate technical interview."
        },
        {
            "id": "cand_102",
            "jobId": "job_01",
            "name": "Elena Rostova",
            "email": "elena.rostova@techcorp.com",
            "phone": "+1 (555) 789-0123",
            "matchScore": 88,
            "skillsMatchScore": 92,
            "experienceMatchScore": 85,
            "educationMatchScore": 85,
            "status": "Under Review",
            "skills": ["Python", "PyTorch", "Transformers", "LLMs", "NLP", "AWS", "Docker", "Git", "SQL"],
            "matchingSkills": ["Python", "PyTorch", "Transformers", "LLMs", "NLP", "AWS", "Docker"],
            "missingSkills": ["Kubernetes", "LangChain"],
            "education": "M.S. in Data Science - University of Michigan",
            "experienceYears": 5,
            "experienceDetails": [
                {"role": "Machine Learning Engineer", "company": "TechCorp Systems", "years": "4 years", "desc": "Developed NLP classifiers for sentiment tracking and customer ticket routing. Managed training pipelines using PyTorch on AWS Sagemaker."},
                {"role": "Data Analyst", "company": "DataSync Co", "years": "1 year", "desc": "Performed statistical analysis, engineered data pipelines, and maintained relational database schemas."}
            ],
            "projects": ["SentimentPulse: Real-time Twitter analysis engine", "LLM-Summarizer: Internal tool for doc compression"],
            "certifications": ["TensorFlow Developer", "Google Cloud Professional Data Engineer"],
            "aiScreeningExplanation": "Elena meets the core requirements of 5 years experience and holds a highly relevant Master's in Data Science. She matches all mandatory skills including PyTorch, Transformers, NLP, and Docker. However, she lacks preferred experience in Kubernetes and Vector Databases. Highly qualified candidate suitable for preliminary phone screening."
        },
        {
            "id": "cand_103",
            "jobId": "job_01",
            "name": "Marcus Vance",
            "email": "marcus.vance@codemail.net",
            "phone": "+1 (555) 234-5678",
            "matchScore": 78,
            "skillsMatchScore": 80,
            "experienceMatchScore": 75,
            "educationMatchScore": 80,
            "status": "Under Review",
            "skills": ["Python", "PyTorch", "NLP", "TensorFlow", "FastAPI", "Docker", "AWS", "Java"],
            "matchingSkills": ["Python", "PyTorch", "NLP", "Docker", "AWS", "FastAPI"],
            "missingSkills": ["Transformers", "LLMs"],
            "education": "B.S. in Computer Science - University of Texas at Austin",
            "experienceYears": 4,
            "experienceDetails": [
                {"role": "Backend / ML Engineer", "company": "AeroData Corp", "years": "4 years", "desc": "Designed backend APIs in FastAPI and integrated TensorFlow predictive models for scheduling algorithms. Deployed containerized applications onto AWS."}
            ],
            "projects": ["AeroForecast: Predictive maintenance pipeline"],
            "certifications": ["AWS Certified Developer"],
            "aiScreeningExplanation": "Marcus is a strong software engineer but lacks specific depth in large language models (LLMs) and modern transformers. He has 4 years of experience (slightly below the 5-year requirement) and a Bachelor's degree (preferred is Master's/Ph.D.). While his Docker/AWS skillset is solid, his NLP training has been focused on traditional models rather than generative architectures."
        },
        {
            "id": "cand_104",
            "jobId": "job_01",
            "name": "Samuel Lin",
            "email": "sam.lin@datastax.io",
            "phone": "+1 (555) 456-7890",
            "matchScore": 65,
            "skillsMatchScore": 70,
            "experienceMatchScore": 60,
            "educationMatchScore": 65,
            "status": "Rejected",
            "skills": ["Python", "SQL", "Pandas", "Scikit-Learn", "R", "Git", "Tableau"],
            "matchingSkills": ["Python"],
            "missingSkills": ["PyTorch", "Transformers", "LLMs", "NLP", "Docker", "AWS"],
            "education": "B.S. in Statistics - Rutgers University",
            "experienceYears": 3,
            "experienceDetails": [
                {"role": "Data Scientist", "company": "DataStax Analytics", "years": "3 years", "desc": "Built predictive churn models, conducted A/B testing, and designed executive dashboards using Tableau and SQL."}
            ],
            "projects": ["ChurnShield: Customer attrition modeling"],
            "certifications": ["Data Science Professional Certificate"],
            "aiScreeningExplanation": "Samuel's background is focused on traditional statistical data science rather than Deep Learning and NLP engineering. He lacks crucial technical capabilities, specifically PyTorch, LLMs, Docker, and AWS cloud deployment. Additionally, his 3 years of experience falls short of the 5-year requirement, and his education is statistics-oriented rather than advanced computing."
        },
        {
            "id": "cand_105",
            "jobId": "job_01",
            "name": "Priya Nair",
            "email": "priya.nair@cloudnet.in",
            "phone": "+1 (555) 901-2345",
            "matchScore": 82,
            "skillsMatchScore": 85,
            "experienceMatchScore": 80,
            "educationMatchScore": 80,
            "status": "Under Review",
            "skills": ["Python", "PyTorch", "NLP", "Transformers", "Docker", "AWS", "Git", "Flask"],
            "matchingSkills": ["Python", "PyTorch", "NLP", "Transformers", "Docker", "AWS"],
            "missingSkills": ["LLMs"],
            "education": "M.S. in Intelligent Systems - UT Dallas",
            "experienceYears": 4,
            "experienceDetails": [
                {"role": "AI Developer", "company": "CloudNet Systems", "years": "4 years", "desc": "Built speech recognition scripts and text-to-speech modules. Containerized model workloads using Docker and deployed via AWS ECS."}
            ],
            "projects": ["VoiceSynth: Custom TTS implementation"],
            "certifications": [],
            "aiScreeningExplanation": "Priya displays a solid academic foundation with an MS in Intelligent Systems. She has 4 years of experience and is proficient in PyTorch, Transformers, NLP, and containerization. Her profile lacks explicit exposure to generative LLMs, but her background suggests she could adapt rapidly. Recommended for a technical screening."
        },
        {
            "id": "cand_106",
            "jobId": "job_01",
            "name": "Liam O'Connor",
            "email": "liam.oconnor@coders.ie",
            "phone": "+1 (555) 345-6789",
            "matchScore": 72,
            "skillsMatchScore": 75,
            "experienceMatchScore": 70,
            "educationMatchScore": 70,
            "status": "Under Review",
            "skills": ["Python", "TensorFlow", "Scikit-Learn", "Keras", "Docker", "AWS", "SQL"],
            "matchingSkills": ["Python", "Docker", "AWS"],
            "missingSkills": ["PyTorch", "Transformers", "LLMs", "NLP"],
            "education": "B.S. in Software Engineering - Trinity College Dublin",
            "experienceYears": 5,
            "experienceDetails": [
                {"role": "Software Engineer (ML Team)", "company": "Global Logic", "years": "5 years", "desc": "Maintained Python backend services, orchestrated CI/CD workflows, and supported model deployments built in TensorFlow."}
            ],
            "projects": ["KubeDeploy: Automated model deployment charts"],
            "certifications": ["Certified Kubernetes Administrator (CKA)"],
            "aiScreeningExplanation": "Liam has a strong systems engineering background, matching our Docker and AWS requirements, but his ML skills are heavily centered around traditional pipelines and TensorFlow. He does not have PyTorch or NLP/LLM experience. He represents a potential fit if the team is willing to retrain him on PyTorch and modern transformer pipelines."
        },

        # Job 02
        {
            "id": "cand_201",
            "jobId": "job_02",
            "name": "Sarah Jenkins",
            "email": "sarah.j@frontenddev.org",
            "phone": "+1 (555) 678-9012",
            "matchScore": 96,
            "skillsMatchScore": 98,
            "experienceMatchScore": 95,
            "educationMatchScore": 95,
            "status": "Shortlisted",
            "skills": ["React", "JavaScript", "TypeScript", "HTML5/CSS3", "Redux Toolkit", "Webpack", "Next.js", "Tailwind CSS", "Jest/Cypress", "GraphQL"],
            "matchingSkills": ["React", "JavaScript", "TypeScript", "HTML5/CSS3", "Redux Toolkit", "Webpack", "Next.js", "Tailwind CSS", "Jest/Cypress"],
            "missingSkills": [],
            "education": "B.S. in Computer Science - Georgia Tech",
            "experienceYears": 7,
            "experienceDetails": [
                {"role": "Lead Frontend Engineer", "company": "SaaSify Inc", "years": "4 years", "desc": "Designed a component-driven React dashboard. Upgraded codebase to TypeScript and reduced initial page loads by 50% through code splitting and tree shaking."},
                {"role": "Senior React Engineer", "company": "WebFlow Agency", "years": "3 years", "desc": "Created pixel-perfect interfaces for consumer-facing clients. Setup automated testing pipelines using Jest and Cypress."}
            ],
            "projects": ["ReactPattern: A library of customizable UX patterns", "Typescriptify: Babel compiler plugin"],
            "certifications": [],
            "aiScreeningExplanation": "Sarah excels in all categories. With 7 years of pure frontend experience and a Bachelor's in CS from Georgia Tech, she has operated as a Lead Frontend Engineer. She matches 100% of required and preferred skills, including React, TypeScript, Next.js, and Jest/Cypress. High alignment with our frontend performance goals."
        },
        {
            "id": "cand_202",
            "jobId": "job_02",
            "name": "David Cho",
            "email": "david.cho@uicraft.com",
            "phone": "+1 (555) 890-1234",
            "matchScore": 89,
            "skillsMatchScore": 90,
            "experienceMatchScore": 88,
            "educationMatchScore": 90,
            "status": "Shortlisted",
            "skills": ["React", "JavaScript", "TypeScript", "HTML5/CSS3", "Redux Toolkit", "Webpack", "Next.js", "Tailwind CSS", "SASS", "Git"],
            "matchingSkills": ["React", "JavaScript", "TypeScript", "HTML5/CSS3", "Redux Toolkit", "Webpack", "Next.js", "Tailwind CSS"],
            "missingSkills": ["Jest/Cypress"],
            "education": "B.S. in Computer Science - UC San Diego",
            "experienceYears": 6,
            "experienceDetails": [
                {"role": "Senior Frontend Developer", "company": "UICraft Software", "years": "3 years", "desc": "Architected micro-frontend systems using React and Webpack Module Federation. Collaborated with designers to enforce design system components."},
                {"role": "Web Developer", "company": "BrightMedia", "years": "3 years", "desc": "Built dynamic landing pages and responsive e-commerce web applications."}
            ],
            "projects": ["FigmaToReact: Code generation CLI tool"],
            "certifications": [],
            "aiScreeningExplanation": "David possesses 6 years of experience and matches all primary core requirements, including TypeScript, Webpack, and Redux Toolkit. He exhibits strong design coordination capabilities and next-gen stack familiarity. He is missing testing experience in Jest/Cypress but remains a top candidate."
        },
        {
            "id": "cand_203",
            "jobId": "job_02",
            "name": "Amina Yusuf",
            "email": "amina.y@codebase.tech",
            "phone": "+1 (555) 901-5678",
            "matchScore": 76,
            "skillsMatchScore": 80,
            "experienceMatchScore": 70,
            "educationMatchScore": 80,
            "status": "Under Review",
            "skills": ["React", "JavaScript", "HTML5/CSS3", "Redux", "Bootstrap", "Git", "Node.js", "Express"],
            "matchingSkills": ["React", "JavaScript", "HTML5/CSS3", "Bootstrap"],
            "missingSkills": ["TypeScript", "Redux Toolkit", "Webpack"],
            "education": "Bachelor of Science - CUNY Queens College",
            "experienceYears": 5,
            "experienceDetails": [
                {"role": "React Engineer", "company": "Global Retail Systems", "years": "3 years", "desc": "Integrated backend APIs into React dashboards. Built modular web forms and managed UI alignments with Bootstrap."},
                {"role": "Junior Web Developer", "company": "SiteDesign Studio", "years": "2 years", "desc": "Drafted HTML layouts, wrote custom jQuery plugins, and maintained client WordPress instances."}
            ],
            "projects": [],
            "certifications": [],
            "aiScreeningExplanation": "Amina has 5 years of web experience but has not yet worked as a lead developer (role requested 6 years). Her skills are solid in vanilla JS and React, but she lacks modern TypeScript experience and the build-system knowledge of Webpack/Redux Toolkit that our project demands. Suitable for mid-level frontend roles instead."
        },
        {
            "id": "cand_204",
            "jobId": "job_02",
            "name": "Lucas Dupont",
            "email": "lucas.dupont@webcode.fr",
            "phone": "+33 6 12 34 56 78",
            "matchScore": 58,
            "skillsMatchScore": 60,
            "experienceMatchScore": 55,
            "educationMatchScore": 60,
            "status": "Rejected",
            "skills": ["JavaScript", "HTML5/CSS3", "jQuery", "Vue.js", "Bootstrap", "PHP", "Laravel"],
            "matchingSkills": ["JavaScript", "HTML5/CSS3", "Bootstrap"],
            "missingSkills": ["React", "TypeScript", "Redux Toolkit", "Webpack"],
            "education": "B.S. in Information Technology - Université de Paris",
            "experienceYears": 3,
            "experienceDetails": [
                {"role": "Full Stack Developer", "company": "WebCode France", "years": "3 years", "desc": "Built MVC applications using Laravel and Vue.js. Maintained legacy jQuery structures and stylized UI layouts using Bootstrap."}
            ],
            "projects": ["AutoInvoice: Invoice generator in PHP"],
            "certifications": [],
            "aiScreeningExplanation": "Lucas does not meet the core stack requirements for this role. The job description demands a Lead React Developer; Lucas is a junior-to-mid full-stack developer with primary expertise in Vue.js and Laravel, and virtually no professional React or TypeScript experience. His 3 years of experience also falls far short of the required 6 years."
        },

        # Job 03
        {
            "id": "cand_301",
            "jobId": "job_03",
            "name": "Chloe Henderson",
            "email": "chloe.h@designlab.co",
            "phone": "+1 (555) 123-4567",
            "matchScore": 92,
            "skillsMatchScore": 95,
            "experienceMatchScore": 90,
            "educationMatchScore": 90,
            "status": "Shortlisted",
            "skills": ["Figma", "UI/UX Design", "Wireframing", "Prototyping", "Design Systems", "Usability Testing", "Adobe Illustrator", "Sketch"],
            "matchingSkills": ["Figma", "UI/UX Design", "Wireframing", "Prototyping", "Design Systems", "Usability Testing"],
            "missingSkills": [],
            "education": "B.F.A. in Graphic Design - Rhode Island School of Design (RISD)",
            "experienceYears": 5,
            "experienceDetails": [
                {"role": "Senior Product Designer", "company": "Fintech Growth", "years": "3 years", "desc": "Redesigned mobile investment dashboard. Created a unified Figma Design System that cut engineering component development times by 30%."},
                {"role": "UI Designer", "company": "Creative Minds Agency", "years": "2 years", "desc": "Drafted mockups and wireframes for mobile games and custom e-commerce web brands."}
            ],
            "projects": ["Systema: Open-source design library", "FinanceFlow App Mockup"],
            "certifications": ["NN/g UX Certification"],
            "aiScreeningExplanation": "Chloe is a highly artistic and methodical designer who studied at RISD. She has 5 years of experience (exceeding the 4-year minimum) and a robust background building unified design systems in Figma. She meets all required skills. Her portfolio contains multiple shipped B2B SaaS interfaces. Strongly recommended."
        },
        {
            "id": "cand_302",
            "jobId": "job_03",
            "name": "Rohan Mehta",
            "email": "rohan.mehta@pixelperfect.in",
            "phone": "+1 (555) 456-1122",
            "matchScore": 84,
            "skillsMatchScore": 88,
            "experienceMatchScore": 80,
            "educationMatchScore": 85,
            "status": "Under Review",
            "skills": ["Figma", "UI/UX Design", "Wireframing", "Prototyping", "Adobe XD", "HTML/CSS", "Bootstrap"],
            "matchingSkills": ["Figma", "UI/UX Design", "Wireframing", "Prototyping", "Basic HTML/CSS", "Bootstrap"],
            "missingSkills": ["Design Systems"],
            "education": "B.S. in Human-Computer Interaction - Indiana University",
            "experienceYears": 4,
            "experienceDetails": [
                {"role": "UX Designer", "company": "Enterprise Solutions Co", "years": "4 years", "desc": "Conducted usability testing sessions with enterprise clients. Created clickable prototypes and wrote basic HTML layouts for product engineers."}
            ],
            "projects": ["TaskManager: Desktop tool layout design"],
            "certifications": ["Google UX Design Professional Certificate"],
            "aiScreeningExplanation": "Rohan fits the experience minimum (4 years) and holds an HCI degree. He has valuable hands-on skills in basic frontend engineering (HTML/CSS) which will facilitate engineering handoffs. He is slightly weak in complex enterprise Design Systems scale, but his wireframing and prototyping capabilities are highly qualified."
        },
        {
            "id": "cand_303",
            "jobId": "job_03",
            "name": "Megan Ward",
            "email": "megan.w@brandstudio.net",
            "phone": "+1 (555) 678-3344",
            "matchScore": 68,
            "skillsMatchScore": 70,
            "experienceMatchScore": 65,
            "educationMatchScore": 70,
            "status": "Under Review",
            "skills": ["Adobe Illustrator", "Photoshop", "InDesign", "Branding", "Graphic Design", "Figma", "Social Media Art"],
            "matchingSkills": ["Figma", "UI/UX Design"],
            "missingSkills": ["Wireframing", "Prototyping", "Design Systems"],
            "education": "B.A. in Fine Arts - Boston University",
            "experienceYears": 3,
            "experienceDetails": [
                {"role": "Graphic Designer", "company": "Brand Studio Agency", "years": "3 years", "desc": "Designed brand assets, logos, social media marketing decks, and printed catalog materials for retail clients."}
            ],
            "projects": ["UrbanApparel Brand Assets"],
            "certifications": [],
            "aiScreeningExplanation": "Megan is primarily a graphic designer and brand illustrator rather than an interaction/product designer. She lacks experience in complex SaaS wireframing, high-fidelity interactive prototyping, and modern design systems. She has only 3 years of experience and lacks B2B SaaS application workflows in her portfolio."
        }
    ]

    for c in initial_candidates:
        cursor.execute("""
            INSERT OR REPLACE INTO candidates
            (id, job_id, name, email, phone, match_score, skills_match_score, experience_match_score, education_match_score, status, skills, matching_skills, missing_skills, education, experience_years, experience_details, projects, certifications, ai_screening_explanation, resume_filename, raw_text)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            c["id"],
            c["jobId"],
            c["name"],
            c.get("email", ""),
            c.get("phone", ""),
            c.get("matchScore", 0),
            c.get("skillsMatchScore", 0),
            c.get("experienceMatchScore", 0),
            c.get("educationMatchScore", 0),
            c.get("status", "Under Review"),
            json.dumps(c.get("skills", [])),
            json.dumps(c.get("matchingSkills", [])),
            json.dumps(c.get("missingSkills", [])),
            c.get("education", ""),
            float(c.get("experienceYears", 0)),
            json.dumps(c.get("experienceDetails", [])),
            json.dumps(c.get("projects", [])),
            json.dumps(c.get("certifications", [])),
            c.get("aiScreeningExplanation", ""),
            f"{c['name'].replace(' ', '_')}_Resume.pdf",
            f"Resume content for {c['name']}. Education: {c.get('education')}. Skills: {', '.join(c.get('skills', []))}."
        ))

    conn.commit()


# =============================================================================
# DATA ACCESS HELPERS (CRUD OPERATIONS & SQL QUERIES)
# =============================================================================

def _row_to_job_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Serializes a SQLite Job row into the frontend-compatible dict schema."""
    if not row:
        return None
    req_skills = json.loads(row["required_skills"]) if row["required_skills"] else []
    pref_skills = json.loads(row["preferred_skills"]) if row["preferred_skills"] else []
    weights = json.loads(row["weights"]) if row["weights"] else {"skills": 0.45, "experience": 0.35, "education": 0.20}

    return {
        "id": row["id"],
        "title": row["title"],
        "department": row["department"],
        "location": row["location"],
        "type": row["type"],
        "createdDate": row["created_date"],
        "status": row["status"],
        "applicantsCount": row["applicants_count"],
        "description": row["description"],
        "requirements": {
            "requiredSkills": req_skills,
            "preferredSkills": pref_skills,
            "minExperience": row["min_experience"],
            "education": row["education"],
            "otherScreeningRules": row["other_screening_rules"]
        },
        "weights": weights
    }


def _row_to_candidate_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Serializes a SQLite Candidate row into frontend-compatible dict schema."""
    if not row:
        return None
    return {
        "id": row["id"],
        "jobId": row["job_id"],
        "name": row["name"],
        "email": row["email"],
        "phone": row["phone"],
        "matchScore": row["match_score"],
        "skillsMatchScore": row["skills_match_score"],
        "experienceMatchScore": row["experience_match_score"],
        "educationMatchScore": row["education_match_score"],
        "status": row["status"],
        "skills": json.loads(row["skills"]) if row["skills"] else [],
        "matchingSkills": json.loads(row["matching_skills"]) if row["matching_skills"] else [],
        "missingSkills": json.loads(row["missing_skills"]) if row["missing_skills"] else [],
        "education": row["education"],
        "experienceYears": row["experience_years"],
        "experienceDetails": json.loads(row["experience_details"]) if row["experience_details"] else [],
        "projects": json.loads(row["projects"]) if row["projects"] else [],
        "certifications": json.loads(row["certifications"]) if row["certifications"] else [],
        "aiScreeningExplanation": row["ai_screening_explanation"],
        "resumeFilename": row["resume_filename"],
        "rawText": row["raw_text"],
        "createdAt": row["created_at"]
    }


# --- COMPANY ---
def get_company(owner_id: str) -> Dict[str, Any]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM companies WHERE owner_id = ?", (owner_id,)).fetchone()
    conn.close()
    if row:
        return dict(row)
    return {"id": f"comp_{owner_id[:12]}", "name": "", "domain": "", "size": "", "industry": "", "plan": "Starter"}


def update_company(data: Dict[str, Any], owner_id: str) -> Dict[str, Any]:
    conn = get_db_connection()
    conn.execute("""
        UPDATE companies SET name = ?, domain = ?, size = ?, industry = ?, plan = ?
        WHERE owner_id = ?
    """, (data.get("name"), data.get("domain"), data.get("size"), data.get("industry"), data.get("plan"), owner_id))
    conn.commit()
    conn.close()
    return get_company(owner_id)


# --- JOBS ---
def get_all_jobs(owner_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    # Synchronize applicants count with actual candidates table count
    rows = conn.execute("""
        SELECT j.*, COUNT(c.id) AS real_applicants_count
        FROM jobs j
        LEFT JOIN candidates c ON j.id = c.job_id AND c.owner_id = j.owner_id
        WHERE j.owner_id = ?
        GROUP BY j.id
        ORDER BY j.created_at DESC
    """, (owner_id,)).fetchall()
    
    result = []
    for r in rows:
        job_data = _row_to_job_dict(r)
        job_data["applicantsCount"] = r["real_applicants_count"]
        result.append(job_data)
        
    conn.close()
    return result


def get_job(job_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM jobs WHERE id = ? AND owner_id = ?", (job_id, owner_id)).fetchone()
    conn.close()
    return _row_to_job_dict(row)


def create_job(data: Dict[str, Any], owner_id: str) -> Dict[str, Any]:
    conn = get_db_connection()
    req = data.get("requirements", {})
    weights = data.get("weights", {"skills": 0.45, "experience": 0.35, "education": 0.20})

    job_id = data.get("id") or f"job_{int(os.urandom(3).hex(), 16)}"
    conn.execute("""
        INSERT INTO jobs 
        (id, title, department, location, type, created_date, status, applicants_count, description, required_skills, preferred_skills, min_experience, education, other_screening_rules, weights, owner_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        job_id,
        data.get("title", "New Position"),
        data.get("department", "Engineering"),
        data.get("location", "Remote"),
        data.get("type", "Full-time"),
        data.get("createdDate") or "2026-10-09",
        data.get("status", "Active"),
        0,
        data.get("description", ""),
        json.dumps(req.get("requiredSkills", [])),
        json.dumps(req.get("preferredSkills", [])),
        float(req.get("minExperience", 0)),
        req.get("education", "Bachelor"),
        req.get("otherScreeningRules", ""),
        json.dumps(weights),
        owner_id
    ))
    conn.commit()
    conn.close()
    return get_job(job_id, owner_id)


def update_job(job_id: str, data: Dict[str, Any], owner_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    req = data.get("requirements", {})
    conn.execute("""
        UPDATE jobs SET
            title = COALESCE(?, title),
            department = COALESCE(?, department),
            location = COALESCE(?, location),
            type = COALESCE(?, type),
            status = COALESCE(?, status),
            description = COALESCE(?, description),
            required_skills = COALESCE(?, required_skills),
            preferred_skills = COALESCE(?, preferred_skills),
            min_experience = COALESCE(?, min_experience),
            education = COALESCE(?, education),
            other_screening_rules = COALESCE(?, other_screening_rules)
        WHERE id = ? AND owner_id = ?
    """, (
        data.get("title"),
        data.get("department"),
        data.get("location"),
        data.get("type"),
        data.get("status"),
        data.get("description"),
        json.dumps(req["requiredSkills"]) if "requiredSkills" in req else None,
        json.dumps(req["preferredSkills"]) if "preferredSkills" in req else None,
        req.get("minExperience"),
        req.get("education"),
        req.get("otherScreeningRules"),
        job_id,
        owner_id
    ))
    conn.commit()
    conn.close()
    return get_job(job_id, owner_id)


def delete_job(job_id: str, owner_id: str) -> bool:
    conn = get_db_connection()
    conn.execute("DELETE FROM candidates WHERE job_id = ? AND owner_id = ?", (job_id, owner_id))
    conn.execute("DELETE FROM resumes WHERE job_id = ? AND owner_id = ?", (job_id, owner_id))
    res = conn.execute("DELETE FROM jobs WHERE id = ? AND owner_id = ?", (job_id, owner_id))
    conn.commit()
    deleted = res.rowcount > 0
    conn.close()
    return deleted


# --- CANDIDATES ---
def get_candidates(owner_id: str, job_id: Optional[str] = None, status: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    query = "SELECT * FROM candidates WHERE owner_id = ?"
    params = [owner_id]

    if job_id:
        query += " AND job_id = ?"
        params.append(job_id)
    if status and status != "All":
        query += " AND status = ?"
        params.append(status)
    if search:
        query += " AND (name LIKE ? OR email LIKE ? OR skills LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    query += " ORDER BY match_score DESC, created_at DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [_row_to_candidate_dict(r) for r in rows]


def get_candidate(candidate_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM candidates WHERE id = ? AND owner_id = ?", (candidate_id, owner_id)).fetchone()
    conn.close()
    return _row_to_candidate_dict(row)


def create_candidate(data: Dict[str, Any], owner_id: str) -> Dict[str, Any]:
    conn = get_db_connection()
    job = conn.execute("SELECT id FROM jobs WHERE id = ? AND owner_id = ?", (data.get("jobId"), owner_id)).fetchone()
    if not job:
        conn.close()
        raise ValueError("The selected job does not belong to this workspace.")
    cid = data.get("id") or f"cand_{int(os.urandom(4).hex(), 16)}"
    conn.execute("""
        INSERT INTO candidates
        (id, job_id, name, email, phone, match_score, skills_match_score, experience_match_score, education_match_score, status, skills, matching_skills, missing_skills, education, experience_years, experience_details, projects, certifications, ai_screening_explanation, resume_filename, raw_text, owner_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        cid,
        data.get("jobId"),
        data.get("name", "Anonymous Candidate"),
        data.get("email", ""),
        data.get("phone", ""),
        data.get("matchScore", 0),
        data.get("skillsMatchScore", 0),
        data.get("experienceMatchScore", 0),
        data.get("educationMatchScore", 0),
        data.get("status", "Under Review"),
        json.dumps(data.get("skills", [])),
        json.dumps(data.get("matchingSkills", [])),
        json.dumps(data.get("missingSkills", [])),
        data.get("education", ""),
        float(data.get("experienceYears", 0)),
        json.dumps(data.get("experienceDetails", [])),
        json.dumps(data.get("projects", [])),
        json.dumps(data.get("certifications", [])),
        data.get("aiScreeningExplanation", ""),
        data.get("resumeFilename", "resume.pdf"),
        data.get("rawText", ""),
        owner_id
    ))
    # Update job applicants count
    conn.execute("""
        UPDATE jobs SET applicants_count = (
            SELECT COUNT(*) FROM candidates WHERE job_id = ? AND owner_id = ?
        ) WHERE id = ? AND owner_id = ?
    """, (data.get("jobId"), owner_id, data.get("jobId"), owner_id))

    conn.commit()
    conn.close()
    return get_candidate(cid, owner_id)


def bulk_insert_candidates(candidates_list: List[Dict[str, Any]], owner_id: str) -> List[Dict[str, Any]]:
    inserted = []
    for c in candidates_list:
        res = create_candidate(c, owner_id)
        inserted.append(res)
    return inserted


def update_candidate_status(candidate_id: str, new_status: str, owner_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    conn.execute("UPDATE candidates SET status = ? WHERE id = ? AND owner_id = ?", (new_status, candidate_id, owner_id))
    conn.commit()
    conn.close()
    return get_candidate(candidate_id, owner_id)


def delete_candidate(candidate_id: str, owner_id: str) -> bool:
    conn = get_db_connection()
    row = conn.execute("SELECT job_id FROM candidates WHERE id = ? AND owner_id = ?", (candidate_id, owner_id)).fetchone()
    if not row:
        conn.close()
        return False
    job_id = row["job_id"]
    conn.execute("DELETE FROM candidates WHERE id = ? AND owner_id = ?", (candidate_id, owner_id))
    conn.execute("DELETE FROM resumes WHERE candidate_id = ? AND owner_id = ?", (candidate_id, owner_id))
    conn.execute("""
        UPDATE jobs SET applicants_count = (
            SELECT COUNT(*) FROM candidates WHERE job_id = ? AND owner_id = ?
        ) WHERE id = ? AND owner_id = ?
    """, (job_id, owner_id, job_id, owner_id))
    conn.commit()
    conn.close()
    return True


# --- RESUMES REPOSITORY ---
def save_resume_record(filename: str, file_type: str, file_size: int, parsed_text: str, owner_id: str, candidate_id: Optional[str] = None, job_id: Optional[str] = None) -> Dict[str, Any]:
    conn = get_db_connection()
    rid = f"res_{int(os.urandom(4).hex(), 16)}"
    conn.execute("""
        INSERT INTO resumes (id, filename, file_type, file_size, parsed_text, candidate_id, job_id, owner_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (rid, filename, file_type, file_size, parsed_text, candidate_id, job_id, owner_id))
    conn.commit()
    conn.close()
    return {"id": rid, "filename": filename, "fileType": file_type, "fileSize": file_size}


def get_all_resumes(owner_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT r.*, c.name as candidate_name, j.title as job_title, c.match_score
        FROM resumes r
        LEFT JOIN candidates c ON r.candidate_id = c.id AND c.owner_id = r.owner_id
        LEFT JOIN jobs j ON r.job_id = j.id AND j.owner_id = r.owner_id
        WHERE r.owner_id = ?
        ORDER BY r.uploaded_at DESC
    """, (owner_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_resume(resume_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute(
        "SELECT id, filename, file_type, parsed_text FROM resumes WHERE id = ? AND owner_id = ?",
        (resume_id, owner_id)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


# --- AGGREGATE ANALYTICS VIA SQL ---
def get_analytics_metrics(owner_id: str) -> Dict[str, Any]:
    conn = get_db_connection()
    total_jobs = conn.execute("SELECT COUNT(*) AS c FROM jobs WHERE owner_id = ?", (owner_id,)).fetchone()["c"]
    total_candidates = conn.execute("SELECT COUNT(*) AS c FROM candidates WHERE owner_id = ?", (owner_id,)).fetchone()["c"]
    shortlisted = conn.execute("SELECT COUNT(*) AS c FROM candidates WHERE owner_id = ? AND status = 'Shortlisted'", (owner_id,)).fetchone()["c"]
    under_review = conn.execute("SELECT COUNT(*) AS c FROM candidates WHERE owner_id = ? AND status = 'Under Review'", (owner_id,)).fetchone()["c"]
    rejected = conn.execute("SELECT COUNT(*) AS c FROM candidates WHERE owner_id = ? AND status = 'Rejected'", (owner_id,)).fetchone()["c"]
    
    avg_score_row = conn.execute("SELECT AVG(match_score) AS a FROM candidates WHERE owner_id = ?", (owner_id,)).fetchone()
    avg_score = round(avg_score_row["a"] or 0, 1)

    # Department breakdown
    dept_rows = conn.execute("""
        SELECT j.department, COUNT(c.id) as cand_count
        FROM jobs j
        LEFT JOIN candidates c ON j.id = c.job_id AND c.owner_id = j.owner_id
        WHERE j.owner_id = ?
        GROUP BY j.department
    """, (owner_id,)).fetchall()

    conn.close()

    return {
        "totalJobs": total_jobs,
        "totalCandidates": total_candidates,
        "shortlistedCount": shortlisted,
        "underReviewCount": under_review,
        "rejectedCount": rejected,
        "averageMatchScore": avg_score,
        "departmentDistribution": {r["department"]: r["cand_count"] for r in dept_rows}
    }


def reset_database(owner_id: str) -> Dict[str, str]:
    """Clears only the current account's workspace data."""
    conn = get_db_connection()
    conn.execute("DELETE FROM resumes WHERE owner_id = ?", (owner_id,))
    conn.execute("DELETE FROM candidates WHERE owner_id = ?", (owner_id,))
    conn.execute("DELETE FROM jobs WHERE owner_id = ?", (owner_id,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Workspace data cleared."}


def create_backup(owner_id: str) -> Dict[str, Any]:
    """Exports only the current account's data for backup and migration."""
    company = get_company(owner_id)
    jobs = get_all_jobs(owner_id)
    candidates = get_candidates(owner_id)
    resumes = get_all_resumes(owner_id)
    metrics = get_analytics_metrics(owner_id)

    import datetime
    return {
        "version": "1.0.0",
        "timestamp": datetime.datetime.now().isoformat(),
        "databaseType": "SQLite 3",
        "company": company,
        "jobs": jobs,
        "candidates": candidates,
        "resumes": resumes,
        "metrics": metrics
    }


def restore_backup(backup_data: Dict[str, Any], owner_id: str) -> Dict[str, Any]:
    """Replaces only the current account's workspace with validated backup data."""
    if not backup_data or "jobs" not in backup_data or "candidates" not in backup_data:
        raise ValueError("Invalid backup format: 'jobs' and 'candidates' required.")

    conn = get_db_connection()
    cursor = conn.cursor()

    # Clear existing data
    cursor.execute("DELETE FROM resumes WHERE owner_id = ?", (owner_id,))
    cursor.execute("DELETE FROM candidates WHERE owner_id = ?", (owner_id,))
    cursor.execute("DELETE FROM jobs WHERE owner_id = ?", (owner_id,))
    cursor.execute("DELETE FROM companies WHERE owner_id = ?", (owner_id,))

    # Restore company
    comp = backup_data.get("company", {})
    if comp:
        cursor.execute("""
            INSERT OR REPLACE INTO companies (id, name, domain, size, industry, plan, owner_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (f"comp_{owner_id[:12]}", comp.get("name", ""), comp.get("domain", ""), comp.get("size", ""), comp.get("industry", ""), comp.get("plan", "Starter"), owner_id))

    job_ids = {}
    candidate_ids = {}

    # Restore jobs using new IDs so imported data can never overwrite another account's records.
    for j in backup_data.get("jobs", []):
        req = j.get("requirements", {})
        new_job_id = f"job_{secrets.token_hex(12)}"
        job_ids[j["id"]] = new_job_id
        cursor.execute("""
            INSERT INTO jobs 
            (id, title, department, location, type, created_date, status, applicants_count, description, required_skills, preferred_skills, min_experience, education, other_screening_rules, weights, owner_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            new_job_id, j["title"], j["department"], j.get("location", "Remote"), j.get("type", "Full-time"),
            j.get("createdDate", "2026-10-09"), j.get("status", "Active"), j.get("applicantsCount", 0),
            j.get("description", ""), json.dumps(req.get("requiredSkills", [])),
            json.dumps(req.get("preferredSkills", [])), float(req.get("minExperience", 0)),
            req.get("education", "Bachelor"), req.get("otherScreeningRules", ""),
            json.dumps(j.get("weights", {"skills": 0.45, "experience": 0.35, "education": 0.20})),
            owner_id
        ))

    # Restore candidates
    for c in backup_data.get("candidates", []):
        mapped_job_id = job_ids.get(c["jobId"])
        if not mapped_job_id:
            continue
        new_candidate_id = f"cand_{secrets.token_hex(12)}"
        candidate_ids[c["id"]] = new_candidate_id
        cursor.execute("""
            INSERT INTO candidates
            (id, job_id, name, email, phone, match_score, skills_match_score, experience_match_score, education_match_score, status, skills, matching_skills, missing_skills, education, experience_years, experience_details, projects, certifications, ai_screening_explanation, resume_filename, raw_text, owner_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            new_candidate_id, mapped_job_id, c["name"], c.get("email", ""), c.get("phone", ""),
            c.get("matchScore", 0), c.get("skillsMatchScore", 0), c.get("experienceMatchScore", 0),
            c.get("educationMatchScore", 0), c.get("status", "Under Review"),
            json.dumps(c.get("skills", [])), json.dumps(c.get("matchingSkills", [])),
            json.dumps(c.get("missingSkills", [])), c.get("education", ""),
            float(c.get("experienceYears", 0)), json.dumps(c.get("experienceDetails", [])),
            json.dumps(c.get("projects", [])), json.dumps(c.get("certifications", [])),
            c.get("aiScreeningExplanation", ""), c.get("resumeFilename", "resume.pdf"),
            c.get("rawText", ""),
            owner_id
        ))

    # Restore resumes
    for r in backup_data.get("resumes", []):
        mapped_job_id = job_ids.get(r.get("job_id") or r.get("jobId"))
        if not mapped_job_id:
            continue
        source_candidate_id = r.get("candidate_id") or r.get("candidateId")
        mapped_candidate_id = candidate_ids.get(source_candidate_id)
        cursor.execute("""
            INSERT INTO resumes (id, filename, file_type, file_size, parsed_text, candidate_id, job_id, owner_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (f"res_{secrets.token_hex(12)}", r.get("filename"), r.get("file_type") or r.get("fileType", "PDF"), r.get("file_size") or r.get("fileSize", 0), r.get("parsed_text", ""), mapped_candidate_id, mapped_job_id, owner_id))

    conn.commit()
    conn.close()

    return {"status": "success", "jobsRestored": len(backup_data.get("jobs", [])), "candidatesRestored": len(backup_data.get("candidates", []))}



if __name__ == "__main__":
    init_db()
    print("Database initialization and seed test completed.")
    print("Database initialized.")
