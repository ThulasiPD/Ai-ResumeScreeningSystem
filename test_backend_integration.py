"""
Backend Integration Test Suite for ApexScreen AI
Tests SQLite Database CRUD, REST API endpoints, and the NLP Screening Pipeline.
"""
import os
import sys
import json
import uuid
from io import BytesIO

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from server import app
import database

def run_tests():
    print("=" * 70)
    print("ApexScreen AI - Backend & SQL Integration Test Suite")
    print("=" * 70)

    client = app.test_client()

    suffix = uuid.uuid4().hex
    alice_email = f"alice-{suffix}@example.test"
    bob_email = f"bob-{suffix}@example.test"
    alice_id = None
    bob_id = None
    try:
        assert client.get("/api/jobs").status_code == 401
        assert client.post("/api/auth/login", json={
            "email": alice_email, "password": "NotRegistered123"
        }).status_code == 401

        alice = client.post("/api/auth/register", json={
            "name": "Alice Recruiter", "company": "Alice Co",
            "email": alice_email, "password": "ValidPass123"
        })
        assert alice.status_code == 201, alice.get_data(as_text=True)
        alice_id = alice.get_json()["user"]["id"]
        assert client.get("/api/jobs").get_json() == []

        job_res = client.post("/api/jobs", json={
            "title": "Senior AI Engineer", "department": "Engineering",
            "location": "Remote", "type": "Full-time", "status": "Active",
            "description": "Build production machine learning systems.",
            "requirements": {
                "requiredSkills": ["Python", "PyTorch", "NLP", "Docker", "AWS"],
                "preferredSkills": ["Kubernetes"], "minExperience": 5,
                "education": "Master's", "otherScreeningRules": ""
            }
        })
        assert job_res.status_code == 201, job_res.get_data(as_text=True)
        job = job_res.get_json()
        edited = client.put(f"/api/jobs/{job['id']}", json={"title": "Senior ML Engineer"})
        assert edited.status_code == 200
        assert edited.get_json()["title"] == "Senior ML Engineer"

        extracted = client.post("/api/jobs/extract", data={
            "file": (BytesIO(b"Data Engineer\n5 years experience\nPython, SQL, AWS"), "data-engineer.txt")
        }, content_type="multipart/form-data")
        assert extracted.status_code == 200, extracted.get_data(as_text=True)
        assert extracted.get_json()["title"] == "Data Engineer"
        assert "Python" in extracted.get_json()["requiredSkills"]
        extracted_job = client.post("/api/jobs", json={
            "title": extracted.get_json()["title"], "department": "Engineering",
            "location": "Remote", "description": extracted.get_json()["description"],
            "requirements": {
                "requiredSkills": extracted.get_json()["requiredSkills"],
                "minExperience": extracted.get_json()["minExperience"],
                "education": extracted.get_json()["education"]
            }
        }).get_json()
        assert client.delete(f"/api/jobs/{extracted_job['id']}").status_code == 200
        assert client.get(f"/api/jobs/{extracted_job['id']}").status_code == 404

        bob = client.post("/api/auth/register", json={
            "name": "Bob Recruiter", "company": "Bob Co",
            "email": bob_email, "password": "OtherPass123"
        })
        assert bob.status_code == 201, bob.get_data(as_text=True)
        bob_id = bob.get_json()["user"]["id"]
        assert client.get("/api/jobs").get_json() == []
        assert client.get("/api/candidates").get_json() == []
        assert client.put(f"/api/jobs/{job['id']}", json={"title": "Hijacked"}).status_code == 404
        assert client.delete(f"/api/jobs/{job['id']}").status_code == 404

        login = client.post("/api/auth/login", json={
            "email": alice_email, "password": "WrongPass123"
        })
        assert login.status_code == 401
        login = client.post("/api/auth/login", json={
            "email": alice_email, "password": "ValidPass123"
        })
        assert login.status_code == 200
        assert login.get_json()["user"]["id"] == alice_id

        resumes = [{
            "filename": "Kavita_Sharma_AI_Resume.txt",
            "content": """Kavita Sharma
Email: kavita.sharma@mltech.ai
Senior Machine Learning Engineer with 6+ years of experience.
Education: Master of Science in Artificial Intelligence.
Skills: Python, PyTorch, NLP, Docker, AWS, Kubernetes.
Senior AI Engineer at NeuralGen (2020 - Present)."""
        }]
        screened = client.post(f"/api/jobs/{job['id']}/screen", json={"resumes": resumes})
        assert screened.status_code == 200, screened.get_data(as_text=True)
        result = screened.get_json()
        assert result["candidatesCount"] == 1
        assert client.get("/api/candidates").get_json()[0]["name"] == "Kavita Sharma"
        candidate_id = client.get("/api/candidates").get_json()[0]["id"]
        status = client.patch(
            f"/api/candidates/{candidate_id}/status", json={"status": "Shortlisted"}
        )
        assert status.status_code == 200
        assert status.get_json()["status"] == "Shortlisted"
        resume_records = client.get("/api/resumes").get_json()
        assert len(resume_records) == 1
        resume_response = client.get(f"/api/resumes/{resume_records[0]['id']}")
        assert resume_response.status_code == 200
        assert "Kavita Sharma" in resume_response.get_data(as_text=True)

        assert client.put(
            f"/api/jobs/{job['id']}", json={"status": "Closed"}
        ).status_code == 200
        assert client.get(f"/api/jobs/{job['id']}").get_json()["status"] == "Closed"
        assert client.get("/api/analytics").get_json()["totalCandidates"] == 1

        client.post("/api/auth/logout")
        client.post("/api/auth/login", json={"email": bob_email, "password": "OtherPass123"})
        assert client.get("/api/jobs").get_json() == []
        assert client.get("/api/candidates").get_json() == []
        assert client.get(f"/api/resumes/{resume_records[0]['id']}").status_code == 404
        print("[SUCCESS] Authentication, account isolation, screening, resume access, and job lifecycle passed.")
    finally:
        conn = database.get_db_connection()
        for user_id in (alice_id, bob_id):
            if user_id:
                conn.execute("DELETE FROM resumes WHERE owner_id = ?", (user_id,))
                conn.execute("DELETE FROM candidates WHERE owner_id = ?", (user_id,))
                conn.execute("DELETE FROM jobs WHERE owner_id = ?", (user_id,))
                conn.execute("DELETE FROM companies WHERE owner_id = ?", (user_id,))
                conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()

if __name__ == "__main__":
    run_tests()
