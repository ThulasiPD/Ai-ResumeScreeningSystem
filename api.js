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
        try {
            const res = await fetch(`${this.baseUrl}/api/jobs`);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn("Using fallback local jobs", e);
        }
        return null;
    },

    // Create a new job in SQLite
    async createJob(jobData) {
        try {
            const res = await fetch(`${this.baseUrl}/api/jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(jobData)
            });
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn("Failed to create job in backend SQL", e);
        }
        return null;
    },

    // Fetch candidates from SQLite
    async getCandidates(jobId = null) {
        try {
            const url = jobId 
                ? `${this.baseUrl}/api/candidates?jobId=${encodeURIComponent(jobId)}`
                : `${this.baseUrl}/api/candidates`;
            const res = await fetch(url);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn("Using fallback local candidates", e);
        }
        return null;
    },

    // Update candidate status in SQLite
    async updateCandidateStatus(candidateId, newStatus) {
        try {
            const res = await fetch(`${this.baseUrl}/api/candidates/${candidateId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn("Failed to update status in backend SQL", e);
        }
        return null;
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
            const res = await fetch(`${this.baseUrl}/api/jobs/${jobId}/screen`, {
                method: "POST",
                body: formData
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            return await res.json();
        } else {
            // Send as JSON text items or file names
            const payload = {
                resumes: fileItems.map(item => ({
                    filename: item.name,
                    content: item.rawText || `Resume for ${item.name.replace(/\.[^/.]+$/, "")}. Skills: Python, Machine Learning, Docker, SQL, Git.`
                }))
            };
            const res = await fetch(`${this.baseUrl}/api/jobs/${jobId}/screen`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            return await res.json();
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
});
