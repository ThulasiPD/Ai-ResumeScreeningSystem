/**
 * ApexScreen AI - Backend API Integration Client
 * Connects the frontend SPA to the Python Flask & SQLite backend.
 */

const ApiClient = {
    // Determine API root (relative if served by Flask, or absolute localhost if opened statically)
    baseUrl: (window.location.port === "5000" || window.location.origin.includes("5000")) 
        ? "" 
        : "http://127.0.0.1:5000",
    
    isConnected: false,

    async request(path, options = {}) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            credentials: "same-origin",
            ...options
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Request failed (${response.status}).`);
        }
        return response.status === 204 ? null : response.json();
    },

    async login(email, password) {
        return this.request("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
    },

    async register(user) {
        return this.request("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user)
        });
    },

    async getCurrentUser() {
        return this.request("/api/auth/me");
    },

    async logout() {
        return this.request("/api/auth/logout", { method: "POST" });
    },

    async updateProfile(profile) {
        return this.request("/api/auth/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(profile)
        });
    },

    async checkHealth() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${this.baseUrl}/api/health`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                this.isConnected = true;
                this.updateStatusBadge(true, data);
                return data;
            }
        } catch (e) {
            this.isConnected = false;
            this.updateStatusBadge(false);
        }
        return null;
    },

    updateStatusBadge(online, healthData = null) {
        const badge = document.getElementById("backend-status-badge");
        const text = document.getElementById("backend-status-text");
        if (!badge || !text) return;

        if (online) {
            badge.className = "badge rounded-pill bg-success-subtle text-success border border-success-subtle d-inline-flex align-items-center gap-1 px-2 py-1 fs-8";
            badge.title = `Connected to Flask & SQLite (${healthData?.database?.totalCandidates || 0} candidates in SQL)`;
            text.textContent = "SQLite & NLP Active";
        } else {
            badge.className = "badge rounded-pill bg-warning-subtle text-warning border border-warning-subtle d-inline-flex align-items-center gap-1 px-2 py-1 fs-8";
            badge.title = "Backend offline - Running in local browser storage mode. Start server with: python run_server.py";
            text.textContent = "Local Offline Mode";
        }
    },

    // Fetch all jobs from SQLite
    async getJobs() {
        return this.request("/api/jobs");
    },

    // Create a new job in SQLite
    async createJob(jobData) {
        return this.request("/api/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jobData)
        });
    },

    async updateJob(jobId, jobData) {
        return this.request(`/api/jobs/${encodeURIComponent(jobId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jobData)
        });
    },

    async deleteJob(jobId) {
        return this.request(`/api/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
    },

    // Fetch candidates from SQLite
    async getCandidates(jobId = null) {
        const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : "";
        return this.request(`/api/candidates${query}`);
    },

    async getCompany() {
        return this.request("/api/company");
    },

    async updateCompany(company) {
        return this.request("/api/company", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(company)
        });
    },

    async getResumes() {
        return this.request("/api/resumes");
    },

    resumeUrl(resumeId) {
        return `${this.baseUrl}/api/resumes/${encodeURIComponent(resumeId)}`;
    },

    async extractJobDescription(file) {
        const body = new FormData();
        body.append("file", file, file.name);
        return this.request("/api/jobs/extract", { method: "POST", body });
    },

    // Update candidate status in SQLite
    async updateCandidateStatus(candidateId, newStatus) {
        return this.request(`/api/candidates/${encodeURIComponent(candidateId)}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
        });
    },

    // Trigger real NLP screening on backend
    async screenResumes(jobId, fileItems) {
        if (!this.isConnected) {
            throw new Error("Backend server is not connected.");
        }

        // Check if we have actual File objects
        const hasRealFiles = fileItems.some(item => item.file instanceof File);

        if (hasRealFiles) {
            const formData = new FormData();
            fileItems.forEach(item => {
                if (item.file instanceof File) {
                    formData.append("files", item.file, item.name);
                }
            });
            return this.request(`/api/jobs/${encodeURIComponent(jobId)}/screen`, {
                method: "POST",
                body: formData
            });
        } else {
            // Send as JSON text items or file names
            const payload = {
                resumes: fileItems.map(item => ({
                    filename: item.name,
                    content: item.rawText || `Resume for ${item.name.replace(/\.[^/.]+$/, "")}. Skills: Python, Machine Learning, Docker, SQL, Git.`
                }))
            };
            return this.request(`/api/jobs/${encodeURIComponent(jobId)}/screen`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        }
    },

    // Reset database
    async resetDatabase() {
        try {
            const res = await fetch(`${this.baseUrl}/api/reset`, { method: "POST" });
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn("Failed to reset backend database", e);
        }
        return null;
    },

    // Export complete SQLite database backup (backing)
    async getBackup() {
        try {
            const res = await fetch(`${this.baseUrl}/api/backup`);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn("Failed to retrieve backend database backup", e);
        }
        return null;
    },

    // Restore database from backup JSON payload
    async restoreBackup(payload) {
        try {
            const res = await fetch(`${this.baseUrl}/api/restore`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) return await res.json();
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        } catch (e) {
            console.error("Failed to restore backend database", e);
            throw e;
        }
    }
};

// Check health immediately on script load
document.addEventListener("DOMContentLoaded", () => {
    ApiClient.checkHealth();
    // Periodically re-check health every 15 seconds
    setInterval(() => ApiClient.checkHealth(), 15000);
    ApiClient.getCurrentUser().then(({ user }) => {
        if (!user) {
            localStorage.removeItem("session_recruiter");
            showView("landing");
            return;
        }
        localStorage.setItem("session_recruiter", JSON.stringify(user));
        currentRecruiter = user;
        showView("dashboard");
        db.syncWithBackend();
    }).catch(() => {
        localStorage.removeItem("session_recruiter");
        showView("landing");
    });
});
