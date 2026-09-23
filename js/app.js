/**
 * Main Frontend SPA Controller & Simulation Engine
 */

// Global Session State variables
let currentRecruiter = { name: "Jane Doe", company: "Apex AI Solutions" };
let currentActiveJobId = null;
let uploadQueue = [];
let uploadProgressInterval = null;

// ==========================================
// 1. ROUTING & VIEW SWITCHERS
// ==========================================

function showView(viewId) {
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.add('d-none');
    });
    
    const target = document.getElementById(`${viewId}-view`);
    if (target) {
        target.classList.remove('d-none');
    }

    if (viewId === 'dashboard') {
        // Load initial dashboard metrics & lists
        updateDashboardView();
        switchDashboardTab('overview');
    }
}

function showAuthView(panelId) {
    showView('auth');
    showAuthPanel(panelId);
}

function showAuthPanel(panelId) {
    const panels = ['login', 'signup', 'forgot', 'sent', 'verify'];
    panels.forEach(p => {
        const el = document.getElementById(`auth-${p}-panel`);
        if (el) el.classList.add('d-none');
    });

    const target = document.getElementById(`auth-${panelId}-panel`);
    if (target) {
        target.classList.remove('d-none');
    }
}

function switchDashboardTab(tabId) {
    // 1. Toggle Sidebar Active State
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
    });
    const activeLink = document.getElementById(`side-${tabId}`);
    if (activeLink) activeLink.classList.add('active');

    // 2. Hide all tab panes
    document.querySelectorAll('.tab-pane-view').forEach(pane => {
        pane.classList.add('d-none');
    });

    // 3. Show active pane
    const activePane = document.getElementById(`tab-${tabId}`);
    if (activePane) activePane.classList.remove('d-none');

    // Close mobile sidebar if open
    document.querySelector('.sidebar').classList.remove('mobile-open');

    // 4. Custom panel updates
    if (tabId === 'overview') {
        updateDashboardView();
        // Render charts via charts.js
        if (typeof renderCompanyAnalytics === 'function') {
            renderCompanyAnalytics();
        }
    } else if (tabId === 'jobs') {
        renderJobsList();
    } else if (tabId === 'candidates') {
        renderGlobalCandidates();
    } else if (tabId === 'resumes') {
        renderResumesRepository();
    } else if (tabId === 'analytics') {
        if (typeof renderCompanyAnalytics === 'function') {
            renderCompanyAnalytics();
        }
        renderGlobalAnalyticsAlternative();
    }
}

function switchWorkspaceSubTab(subTabId) {
    document.querySelectorAll('.workspace-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`wstab-${subTabId}`);
    if (activeBtn) activeBtn.classList.add('active');

    document.querySelectorAll('.ws-pane-view').forEach(pane => {
        pane.classList.add('d-none');
    });

    const activePane = document.getElementById(`wsview-${subTabId}`);
    if (activePane) activePane.classList.remove('d-none');

    if (subTabId === 'ranking') {
        renderWorkspaceCandidates();
    } else if (subTabId === 'analytics' && currentActiveJobId) {
        if (typeof renderJobAnalytics === 'function') {
            renderJobAnalytics(currentActiveJobId);
        }
    } else if (subTabId === 'details') {
        renderWorkspaceDetails();
    }
}

function switchSettingsSection(sectionId) {
    document.querySelectorAll('#settings-menu-tabs a').forEach(a => {
        a.classList.remove('active');
    });
    
    // Find link matching sectionId
    const targetLink = Array.from(document.querySelectorAll('#settings-menu-tabs a')).find(a => a.getAttribute('onclick').includes(sectionId));
    if (targetLink) targetLink.classList.add('active');

    const sections = ['profile', 'weights', 'security'];
    sections.forEach(s => {
        const el = document.getElementById(`settings-section-${s}`);
        if (el) el.classList.add('d-none');
    });

    const targetSection = document.getElementById(`settings-section-${sectionId}`);
    if (targetSection) targetSection.classList.remove('d-none');
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('mobile-open');
}

function scrollToElement(id) {
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
    }
}

function showWorkflowDetail(step) {
    const titles = {
        1: "Step 1: Define Job & AI Rules",
        2: "Step 2: Bulk Resume Upload",
        3: "Step 3: AI Screening & Extraction",
        4: "Step 4: Review & Shortlist Candidates"
    };
    const descs = {
        1: "Create a job entry, specifying required technical skills, preferred qualifications, experience tiers, and educational levels. The screening engine compiles this metadata to construct custom matching vectors.",
        2: "Drag and drop dozens of candidate CVs in PDF or DOCX format. Have multiple resumes in separate directories? Simply compress them into a ZIP folder and upload the package directly for bulk sorting.",
        3: "Our NLP pipelines perform semantic reading, identifying experience durations, parsing skills lists, extracting project logs, and matching synonyms accurately without basic keyword-matching bias.",
        4: "Review ranked candidate scorecards with transparent visual match gauges, view detailed AI match logs showing missing and matching skills, and move top fits straight to shortlisted queues."
    };

    document.querySelectorAll('.workflow-node').forEach(node => {
        node.classList.remove('active');
    });
    document.getElementById(`node-step${step}`).classList.add('active');

    document.getElementById('workflow-step-title').textContent = titles[step];
    document.getElementById('workflow-step-desc').textContent = descs[step];
}

// ==========================================
// 2. AUTHENTICATION LOGIC (SIMULATORS)
// ==========================================

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    
    // Create custom recruiter metadata
    const namePart = email.split('@')[0];
    const recName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    const companyPart = email.split('@')[1] ? email.split('@')[1].split('.')[0] : "Apex AI Solutions";
    const compName = companyPart.charAt(0).toUpperCase() + companyPart.slice(1) + " Co";

    currentRecruiter = {
        name: recName,
        company: compName
    };

    // Store in localStorage to simulate login session
    localStorage.setItem("session_recruiter", JSON.stringify(currentRecruiter));
    
    showToast(`Welcome back, ${recName}! Isolated company data successfully verified.`);
    showView('dashboard');
}

function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const company = document.getElementById('signup-company').value;
    const email = document.getElementById('signup-email').value;

    currentRecruiter = { name, company };
    localStorage.setItem("session_recruiter", JSON.stringify(currentRecruiter));

    showAuthPanel('verify');
    showToast(`Verification code sent to ${email}`);
}

function handleVerification(e) {
    e.preventDefault();
    showToast("Email address verified! Accessing secure portal...");
    showView('dashboard');
}

function handleForgot(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    document.getElementById('sent-email-placeholder').textContent = email;
    showAuthPanel('sent');
}

function simulateOAuth() {
    currentRecruiter = { name: "Google Cloud Administrator", company: "Apex AI Solutions" };
    localStorage.setItem("session_recruiter", JSON.stringify(currentRecruiter));
    showToast("Google Authentication approved. Welcome to your recruiter panel.");
    showView('dashboard');
}

function handleLogout() {
    localStorage.removeItem("session_recruiter");
    showToast("You have been securely logged out from your recruiter session.");
    showView('landing');
}

// ==========================================
// 3. DASHBOARD MAIN LOADER
// ==========================================

function updateDashboardView() {
    // 1. Recruiter labels
    const sessionUser = JSON.parse(localStorage.getItem("session_recruiter"));
    if (sessionUser) {
        currentRecruiter = sessionUser;
    }
    
    document.getElementById('sidebar-recruiter-name').textContent = currentRecruiter.name;
    document.getElementById('sidebar-recruiter-company').textContent = currentRecruiter.company;
    document.getElementById('setting-rec-name').value = currentRecruiter.name;
    document.getElementById('setting-rec-company').value = currentRecruiter.company;

    // Render avatar initials
    const initials = currentRecruiter.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
    document.getElementById('user-avatar-placeholder').textContent = initials;

    // 2. Metrics summary calculations
    const jobs = db.getJobs();
    const candidates = db.getCandidates();
    
    const activeJobsCount = jobs.filter(j => j.status === 'Active').length;
    const totalApplicantsCount = candidates.length;
    const shortlistedCount = candidates.filter(c => c.status === 'Shortlisted').length;
    
    let sumScore = 0;
    candidates.forEach(c => sumScore += c.matchScore);
    const avgScore = candidates.length > 0 ? Math.round(sumScore / candidates.length) : 0;

    document.getElementById('metric-active-jobs').textContent = activeJobsCount;
    document.getElementById('metric-total-applicants').textContent = totalApplicantsCount;
    document.getElementById('metric-shortlisted').textContent = shortlistedCount;
    document.getElementById('metric-avg-score').textContent = `${avgScore}%`;
}

// ==========================================
// 4. JOB LIST DIRECTORY
// ==========================================

function renderJobsList() {
    const jobs = db.getJobs();
    const tbody = document.querySelector('#table-jobs-list tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    jobs.forEach(job => {
        const jobCandidates = db.getCandidatesByJob(job.id);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="fw-bold text-dark">${job.title}</div>
                <span class="text-muted fs-8">${job.type}</span>
            </td>
            <td>${job.department}</td>
            <td>${job.location}</td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-light text-dark border">${jobCandidates.length} applicants</span>
                </div>
            </td>
            <td><span class="badge-status badge-shortlisted">${job.status}</span></td>
            <td>${job.createdDate}</td>
            <td class="text-end">
                <button class="btn btn-outline-primary btn-sm me-2" onclick="openJobWorkspace('${job.id}')"><i class="fa-solid fa-folder-open me-2"></i>Workspace</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function handleCreateJob(e) {
    e.preventDefault();
    
    const title = document.getElementById('job-title-input').value;
    const department = document.getElementById('job-dept-input').value;
    const location = document.getElementById('job-loc-input').value;
    const type = document.getElementById('job-type-input').value;
    const description = document.getElementById('job-desc-input').value;
    
    const reqString = document.getElementById('job-reqskills-input').value;
    const requiredSkills = reqString.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    const prefString = document.getElementById('job-prefskills-input').value;
    const preferredSkills = prefString.split(',').map(s => s.trim()).filter(s => s.length > 0);

    const minExperience = parseInt(document.getElementById('job-exp-input').value) || 0;
    const education = document.getElementById('job-edu-input').value;
    const otherRules = document.getElementById('job-rules-input').value;

    const newId = `job_${Date.now()}`;
    const newJob = {
        id: newId,
        title,
        department,
        location,
        type,
        createdDate: new Date().toISOString().split('T')[0],
        status: "Active",
        applicantsCount: 0,
        description,
        requirements: {
            requiredSkills,
            preferredSkills,
            minExperience,
            education,
            otherScreeningRules: otherRules
        }
    };

    db.addJob(newJob);
    showToast("Job requirements created successfully! File workspace is ready.");
    
    // Clear Form
    document.getElementById('form-create-job').reset();
    
    // Switch to workspace for this job directly
    openJobWorkspace(newId);
}

// ==========================================
// 5. JOB-SPECIFIC WORKSPACE WORKFLOWS
// ==========================================

function openJobWorkspace(jobId) {
    const job = db.getJobs().find(j => j.id === jobId);
    if (!job) return;

    currentActiveJobId = jobId;
    
    // Clear upload queue from previous workspace views
    uploadQueue = [];
    document.getElementById('upload-queue-card').classList.add('d-none');
    document.getElementById('upload-files-list').innerHTML = '';

    // Update Header Text labels
    document.getElementById('workspace-job-title').textContent = job.title;
    document.getElementById('workspace-job-location').innerHTML = `<i class="fa-solid fa-map-pin me-2"></i>${job.location}`;
    document.getElementById('workspace-job-dept').textContent = `${job.department} Department`;

    // Render initial workspace subtab
    switchDashboardTab('job-workspace');
    switchWorkspaceSubTab('details');
}

function renderWorkspaceDetails() {
    const job = db.getJobs().find(j => j.id === currentActiveJobId);
    if (!job) return;

    document.getElementById('ws-details-desc').innerHTML = job.description.replace(/\n/g, '<br>');
    document.getElementById('ws-details-exp').textContent = `${job.requirements.minExperience} years`;
    document.getElementById('ws-details-edu').textContent = job.requirements.education;

    const reqDiv = document.getElementById('ws-details-reqskills');
    reqDiv.innerHTML = '';
    job.requirements.requiredSkills.forEach(s => {
        reqDiv.innerHTML += `<span class="skill-tag skill-neutral me-1">${s}</span>`;
    });

    const prefDiv = document.getElementById('ws-details-prefskills');
    prefDiv.innerHTML = '';
    if (job.requirements.preferredSkills.length === 0) {
        prefDiv.innerHTML = '<span class="text-muted fs-8 italic">None specified</span>';
    } else {
        job.requirements.preferredSkills.forEach(s => {
            prefDiv.innerHTML += `<span class="skill-tag skill-match me-1" style="background-color:rgba(144,158,132,0.1); color: var(--brand-secondary);">${s}</span>`;
        });
    }
}

// ==========================================
// 6. BULK RESUME UPLOAD SIMULATORS
// ==========================================

function triggerFilePicker() {
    document.getElementById('file-picker').click();
}

function handleFileSelection(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    processSelectedFiles(files);
}

function processSelectedFiles(files) {
    files.forEach(file => {
        // Prevent duplicate queue entries
        if (uploadQueue.some(item => item.name === file.name)) return;

        uploadQueue.push({
            name: file.name,
            size: file.size,
            type: file.name.split('.').pop().toUpperCase(),
            progress: 0,
            status: 'queued' // queued, parsing, success, error
        });
    });

    renderUploadQueue();
}

function renderUploadQueue() {
    const card = document.getElementById('upload-queue-card');
    const container = document.getElementById('upload-files-list');
    
    if (uploadQueue.length === 0) {
        card.classList.add('d-none');
        return;
    }

    card.classList.remove('d-none');
    container.innerHTML = '';
    
    document.getElementById('upload-file-count').textContent = uploadQueue.length;

    uploadQueue.forEach((file, index) => {
        const sizeKB = Math.round(file.size / 1024) || 24; // fallback for drag simulation
        
        let statusBadge = `<span class="text-muted fs-8 fw-semibold">Waiting</span>`;
        if (file.status === 'parsing') {
            statusBadge = `<span class="text-warning fs-8 fw-semibold"><i class="fa-solid fa-circle-notch fa-spin me-1"></i>Uploading</span>`;
        } else if (file.status === 'success') {
            statusBadge = `<span class="text-success fs-8 fw-semibold"><i class="fa-solid fa-circle-check me-1"></i>Verified</span>`;
        }

        const div = document.createElement('div');
        div.className = 'upload-file-item';
        div.innerHTML = `
            <div class="d-flex align-items-center gap-3 flex-grow-1 me-3 text-truncate">
                <div class="fs-4 text-primary"><i class="fa-solid ${file.type === 'ZIP' ? 'fa-file-zipper text-warning' : 'fa-file-lines'}"></i></div>
                <div class="text-truncate w-100">
                    <div class="fw-bold text-dark fs-7 text-truncate m-0">${file.name}</div>
                    <div class="text-muted fs-8">${file.type} • ${sizeKB} KB</div>
                    <div class="file-progress-bar">
                        <div class="file-progress-fill" id="progress-fill-${index}" style="width: ${file.progress}%"></div>
                    </div>
                </div>
            </div>
            <div class="d-flex align-items-center gap-3">
                ${statusBadge}
                <a href="#" class="text-danger fs-8" onclick="removeQueueItem(${index})"><i class="fa-solid fa-xmark"></i></a>
            </div>
        `;
        container.appendChild(div);
    });
}

function removeQueueItem(index) {
    uploadQueue.splice(index, 1);
    renderUploadQueue();
}

function clearUploadQueue() {
    uploadQueue = [];
    renderUploadQueue();
}

// Drag & Drop handlers
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = Array.from(dt.files);
        if (files.length > 0) {
            processSelectedFiles(files);
        }
    }, false);
});

// ==========================================
// 7. AI SCREENING STEPS SIMULATION
// ==========================================

function triggerAISimulator() {
    if (uploadQueue.length === 0) return;

    // Switch View Tab inside Workspace
    switchWorkspaceSubTab('screening');

    // Reset status elements to initial values
    const steps = ['upload', 'extract', 'profile', 'match', 'score', 'rank'];
    steps.forEach((step, idx) => {
        const icon = document.getElementById(`step-${step}-icon`);
        if (icon) {
            icon.className = 'step-indicator-icon step-pending';
            icon.innerHTML = idx + 1;
        }
    });

    let currentStepIndex = 0;
    
    // Simulate step timing
    function runNextStep() {
        if (currentStepIndex >= steps.length) {
            // Finished!
            clearInterval(uploadProgressInterval);
            
            // Mark job candidates as available
            showToast(`AI screening completed! ${db.getCandidatesByJob(currentActiveJobId).length} candidates ranked.`);
            
            // Switch sub-tab to candidate rankings list
            switchWorkspaceSubTab('ranking');
            return;
        }

        const currentStep = steps[currentStepIndex];
        const currentIcon = document.getElementById(`step-${currentStep}-icon`);
        const textLabel = document.getElementById('screening-progress-txt');

        // Set current step as running
        if (currentIcon) {
            currentIcon.className = 'step-indicator-icon step-running';
            currentIcon.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
        }
        textLabel.textContent = `Processing: Step ${currentStepIndex + 1} of 6`;

        // Wait then mark complete
        setTimeout(() => {
            if (currentIcon) {
                currentIcon.className = 'step-indicator-icon step-completed';
                currentIcon.innerHTML = `<i class="fa-solid fa-check"></i>`;
            }
            
            // Increment
            currentStepIndex++;
            runNextStep();
        }, 1500); // 1.5 seconds per step
    }

    runNextStep();
}

// ==========================================
// 8. CANDIDATE WORKSPACE RANKINGS LIST
// ==========================================

function renderWorkspaceCandidates() {
    const list = db.getCandidatesByJob(currentActiveJobId);
    const tbody = document.querySelector('#table-candidates-ranking tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">No applicants screened yet. Visit the "Bulk Upload" tab to add resumes.</td></tr>`;
        return;
    }

    list.forEach((cand, idx) => {
        // Evaluate score badge colors
        let scoreClass = 'score-low';
        if (cand.matchScore >= 85) scoreClass = 'score-high';
        else if (cand.matchScore >= 70) scoreClass = 'score-medium';

        let statusBadge = 'badge-review';
        if (cand.status === 'Shortlisted') statusBadge = 'badge-shortlisted';
        else if (cand.status === 'Rejected') statusBadge = 'badge-rejected';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong class="text-dark">#${idx + 1}</strong></td>
            <td>
                <div class="fw-bold text-dark">${cand.name}</div>
                <span class="text-muted fs-8">${cand.email}</span>
            </td>
            <td>
                <div class="candidate-score-badge ${scoreClass}">${cand.matchScore}%</div>
            </td>
            <td>
                <div class="fw-semibold text-dark">${cand.experienceYears} Years</div>
                <span class="text-muted fs-8 text-truncate d-inline-block" style="max-width:180px;">${cand.experienceDetails[0] ? cand.experienceDetails[0].role : 'Junior'}</span>
            </td>
            <td>
                <div class="text-truncate fs-7" style="max-width: 180px;" title="${cand.education}">${cand.education}</div>
            </td>
            <td>
                <span class="badge-status ${statusBadge}">${cand.status}</span>
            </td>
            <td class="text-end">
                <div class="d-flex align-items-center justify-content-end gap-2">
                    <button class="btn btn-outline-primary btn-sm px-2" onclick="viewCandidateProfile('${cand.id}')" title="Analyze Insights"><i class="fa-solid fa-sparkles"></i> Insights</button>
                    
                    <div class="dropdown">
                        <button class="btn btn-light btn-sm px-2 border" data-bs-toggle="dropdown" aria-expanded="false"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                        <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                            <li><a class="dropdown-item fs-8" href="#" onclick="changeCandidateStatus('${cand.id}', 'Shortlisted')"><i class="fa-solid fa-circle-check text-success me-2"></i>Shortlist</a></li>
                            <li><a class="dropdown-item fs-8" href="#" onclick="changeCandidateStatus('${cand.id}', 'Under Review')"><i class="fa-solid fa-clock text-warning me-2"></i>Mark Review</a></li>
                            <li><a class="dropdown-item fs-8" href="#" onclick="changeCandidateStatus('${cand.id}', 'Rejected')"><i class="fa-solid fa-circle-xmark text-danger me-2"></i>Reject</a></li>
                        </ul>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateScoreRangeLabel(val) {
    document.getElementById('label-range-score').textContent = `${val}%`;
    applyRankingFilters();
}

function applyRankingFilters() {
    const list = db.getCandidatesByJob(currentActiveJobId);
    const searchVal = document.getElementById('filter-rank-search').value.toLowerCase();
    const statusVal = document.getElementById('filter-rank-status').value;
    const scoreVal = parseInt(document.getElementById('filter-rank-score').value) || 0;

    const filtered = list.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchVal) || c.skills.some(s => s.toLowerCase().includes(searchVal));
        const matchesStatus = statusVal === 'All' || c.status === statusVal;
        const matchesScore = c.matchScore >= scoreVal;

        return matchesSearch && matchesStatus && matchesScore;
    });

    const tbody = document.querySelector('#table-candidates-ranking tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No candidates matched the specified filters.</td></tr>`;
        return;
    }

    filtered.forEach((cand, idx) => {
        let scoreClass = 'score-low';
        if (cand.matchScore >= 85) scoreClass = 'score-high';
        else if (cand.matchScore >= 70) scoreClass = 'score-medium';

        let statusBadge = 'badge-review';
        if (cand.status === 'Shortlisted') statusBadge = 'badge-shortlisted';
        else if (cand.status === 'Rejected') statusBadge = 'badge-rejected';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong class="text-dark">#${idx + 1}</strong></td>
            <td>
                <div class="fw-bold text-dark">${cand.name}</div>
                <span class="text-muted fs-8">${cand.email}</span>
            </td>
            <td>
                <div class="candidate-score-badge ${scoreClass}">${cand.matchScore}%</div>
            </td>
            <td>
                <div class="fw-semibold text-dark">${cand.experienceYears} Years</div>
                <span class="text-muted fs-8 text-truncate d-inline-block" style="max-width:180px;">${cand.experienceDetails[0] ? cand.experienceDetails[0].role : 'Junior'}</span>
            </td>
            <td>
                <div class="text-truncate fs-7" style="max-width: 180px;">${cand.education}</div>
            </td>
            <td>
                <span class="badge-status ${statusBadge}">${cand.status}</span>
            </td>
            <td class="text-end">
                <div class="d-flex align-items-center justify-content-end gap-2">
                    <button class="btn btn-outline-primary btn-sm px-2" onclick="viewCandidateProfile('${cand.id}')"><i class="fa-solid fa-sparkles"></i> Insights</button>
                    
                    <div class="dropdown">
                        <button class="btn btn-light btn-sm px-2 border" data-bs-toggle="dropdown" aria-expanded="false"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                        <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                            <li><a class="dropdown-item fs-8" href="#" onclick="changeCandidateStatus('${cand.id}', 'Shortlisted')"><i class="fa-solid fa-circle-check text-success me-2"></i>Shortlist</a></li>
                            <li><a class="dropdown-item fs-8" href="#" onclick="changeCandidateStatus('${cand.id}', 'Under Review')"><i class="fa-solid fa-clock text-warning me-2"></i>Mark Review</a></li>
                            <li><a class="dropdown-item fs-8" href="#" onclick="changeCandidateStatus('${cand.id}', 'Rejected')"><i class="fa-solid fa-circle-xmark text-danger me-2"></i>Reject</a></li>
                        </ul>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function resetRankingFilters() {
    document.getElementById('filter-rank-search').value = '';
    document.getElementById('filter-rank-status').value = 'All';
    document.getElementById('filter-rank-score').value = 0;
    document.getElementById('label-range-score').textContent = '0%';
    applyRankingFilters();
}

function changeCandidateStatus(candidateId, newStatus) {
    db.updateCandidateStatus(candidateId, newStatus);
    showToast(`Applicant status marked as: ${newStatus}`);
    
    // Rerender lists
    applyRankingFilters();
    updateDashboardView();
}

// ==========================================
// 9. CANDIDATE PROFILE ASSESSMENT INSIGHTS
// ==========================================

function viewCandidateProfile(candidateId) {
    const candidates = db.getCandidates();
    const cand = candidates.find(c => c.id === candidateId);
    if (!cand) return;

    // Switch to Details sub view
    switchWorkspaceSubTab('candidate-detail');

    // Fill profile fields
    document.getElementById('cand-detail-name').textContent = cand.name;
    document.getElementById('cand-detail-contact').textContent = `${cand.email} • ${cand.phone}`;
    document.getElementById('cand-detail-score').textContent = `${cand.matchScore}%`;
    document.getElementById('cand-detail-score-skills').textContent = `${cand.skillsMatchScore}%`;
    document.getElementById('cand-detail-score-exp').textContent = `${cand.experienceMatchScore}%`;
    document.getElementById('cand-detail-score-edu').textContent = `${cand.educationMatchScore}%`;
    document.getElementById('cand-detail-ai-summary').textContent = cand.aiScreeningExplanation;
    document.getElementById('cand-detail-education-txt').textContent = cand.education;

    // Apply Status Select value
    document.getElementById('cand-detail-status-select').value = cand.status;

    // Fill Matching Skills
    const matchingDiv = document.getElementById('cand-detail-skills-matching');
    matchingDiv.innerHTML = '';
    if (cand.matchingSkills.length === 0) {
        matchingDiv.innerHTML = '<span class="text-muted fs-8 italic">No matching skills found</span>';
    } else {
        cand.matchingSkills.forEach(s => {
            matchingDiv.innerHTML += `<span class="skill-tag skill-match me-1">${s}</span>`;
        });
    }

    // Fill Missing Skills
    const missingDiv = document.getElementById('cand-detail-skills-missing');
    missingDiv.innerHTML = '';
    if (cand.missingSkills.length === 0) {
        missingDiv.innerHTML = '<span class="text-success fs-8 fw-semibold"><i class="fa-solid fa-circle-check me-2"></i>All requirements met</span>';
    } else {
        cand.missingSkills.forEach(s => {
            missingDiv.innerHTML += `<span class="skill-tag skill-missing me-1">${s}</span>`;
        });
    }

    // Fill Experience Timeline
    const timeline = document.getElementById('cand-detail-experience-timeline');
    timeline.innerHTML = '';
    cand.experienceDetails.forEach(exp => {
        const div = document.createElement('div');
        div.className = 'mb-3 border-start border-3 border-primary-light ps-3 position-relative';
        div.innerHTML = `
            <div style="position: absolute; left: -7px; top: 0; width: 11px; height: 11px; border-radius:50%; background-color: var(--brand-primary)"></div>
            <div class="fw-bold text-dark fs-7">${exp.role}</div>
            <div class="text-muted fs-8 fw-semibold mb-1">${exp.company} • ${exp.years}</div>
            <p class="text-muted fs-8 m-0">${exp.desc}</p>
        `;
        timeline.appendChild(div);
    });

    // Fill projects
    const projDiv = document.getElementById('cand-detail-projects');
    projDiv.innerHTML = '';
    if (cand.projects.length === 0) {
        projDiv.innerHTML = '<span class="text-muted fs-8 italic">No associated project links</span>';
    } else {
        cand.projects.forEach(p => {
            projDiv.innerHTML += `<div class="fs-8 text-dark mb-1"><i class="fa-solid fa-code text-secondary me-2"></i>${p}</div>`;
        });
    }
}

function changeCandidateStatusFromDetail(status) {
    // Get currently viewed candidate
    const name = document.getElementById('cand-detail-name').textContent;
    const candidates = db.getCandidates();
    const cand = candidates.find(c => c.name === name);
    if (!cand) return;

    changeCandidateStatus(cand.id, status);
}

// ==========================================
// 10. GLOBAL LISTS & ARCHIVE TABS
// ==========================================

function renderGlobalCandidates() {
    const list = db.getCandidates();
    const tbody = document.querySelector('#table-global-candidates tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    list.forEach(c => {
        const job = db.getJobs().find(j => j.id === c.jobId);
        const jobTitle = job ? job.title : 'General Pool';

        let scoreClass = 'score-low';
        if (c.matchScore >= 85) scoreClass = 'score-high';
        else if (c.matchScore >= 70) scoreClass = 'score-medium';

        let statusBadge = 'badge-review';
        if (c.status === 'Shortlisted') statusBadge = 'badge-shortlisted';
        else if (c.status === 'Rejected') statusBadge = 'badge-rejected';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong class="text-dark">${c.name}</strong></td>
            <td class="fw-semibold text-dark">${jobTitle}</td>
            <td><div class="candidate-score-badge ${scoreClass} small">${c.matchScore}%</div></td>
            <td>${c.email}</td>
            <td><span class="badge-status ${statusBadge}">${c.status}</span></td>
            <td class="text-end">
                <button class="btn btn-outline-primary btn-sm" onclick="openJobWorkspace('${c.jobId}'); viewCandidateProfile('${c.id}');">Inspect Profile</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function renderResumesRepository() {
    const list = db.getCandidates();
    const tbody = document.querySelector('#table-resumes-repository tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    list.forEach(c => {
        const job = db.getJobs().find(j => j.id === c.jobId);
        const jobTitle = job ? job.title : 'General Pool';

        const sizeKB = 32 + Math.floor(Math.random() * 64);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="fw-bold text-dark"><i class="fa-solid fa-file-pdf text-danger me-2"></i>CV_${c.name.replace(/\s+/g, '_')}.pdf</div>
            </td>
            <td>${jobTitle}</td>
            <td>${sizeKB} KB</td>
            <td><span class="text-success fw-bold fs-8"><i class="fa-solid fa-shield-check me-1"></i>Verified</span></td>
            <td>2026-08-26</td>
        `;
        tbody.appendChild(row);
    });
}

function renderGlobalAnalyticsAlternative() {
    // Standard drawing fallback if needed. Renders Chart spreads.
    const candidates = db.getCandidates();
    const canvas = document.getElementById('chart-global-score-spread-alternative');
    if (!canvas) return;

    // Destroy former instance
    if (activeCharts['global-alt']) {
        activeCharts['global-alt'].destroy();
    }

    const labels = candidates.map(c => c.name);
    const data = candidates.map(c => c.matchScore);

    activeCharts['global-alt'] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Candidate Match Rating',
                data: data,
                backgroundColor: BrandPalette.primary,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { min: 0, max: 100, ticks: { stepSize: 20 }, grid: { color: BrandPalette.border } },
                x: { ticks: { font: { size: 9 } }, grid: { display: false } }
            }
        }
    });
}

// ==========================================
// 11. GLOBAL UTILITIES & NOTIFICATIONS
// ==========================================

function showToast(message) {
    const textEl = document.getElementById('toast-text-body');
    const toastEl = document.getElementById('globalToast');
    if (!textEl || !toastEl) return;

    textEl.textContent = message;

    const bootstrapToast = new bootstrap.Toast(toastEl, { delay: 3500 });
    bootstrapToast.show();
}

function handleGlobalSearch(e) {
    const query = e.target.value.toLowerCase();
    
    // Dynamically search in whatever tab is active
    const activeTabLink = document.querySelector('.sidebar-link.active');
    if (!activeTabLink) return;

    const tabId = activeTabLink.id.replace('side-', '');

    if (tabId === 'jobs') {
        const trs = document.querySelectorAll('#table-jobs-list tbody tr');
        trs.forEach(tr => {
            const match = tr.textContent.toLowerCase().includes(query);
            tr.style.display = match ? '' : 'none';
        });
    } else if (tabId === 'candidates') {
        const trs = document.querySelectorAll('#table-global-candidates tbody tr');
        trs.forEach(tr => {
            const match = tr.textContent.toLowerCase().includes(query);
            tr.style.display = match ? '' : 'none';
        });
    } else if (tabId === 'resumes') {
        const trs = document.querySelectorAll('#table-resumes-repository tbody tr');
        trs.forEach(tr => {
            const match = tr.textContent.toLowerCase().includes(query);
            tr.style.display = match ? '' : 'none';
        });
    }
}

function saveSettingsProfile(e) {
    e.preventDefault();
    const name = document.getElementById('setting-rec-name').value;
    const company = document.getElementById('setting-rec-company').value;

    currentRecruiter = { name, company };
    localStorage.setItem("session_recruiter", JSON.stringify(currentRecruiter));
    
    updateDashboardView();
    showToast("Profile credentials updated successfully.");
}

// Global bootstrap initializer
document.addEventListener('DOMContentLoaded', () => {
    // Initial display config: check if user session already exists
    const sessionUser = localStorage.getItem("session_recruiter");
    if (sessionUser) {
        currentRecruiter = JSON.parse(sessionUser);
        showView('dashboard');
    } else {
        showView('landing');
    }
});
