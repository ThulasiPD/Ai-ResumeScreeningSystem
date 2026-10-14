/**
 * Main Frontend SPA Controller & Simulation Engine
 */

// Global Session State variables
let currentRecruiter = { name: "Jane Doe", company: "Apex AI Solutions" };
let currentActiveJobId = null;
let uploadQueue = [];
let uploadProgressInterval = null;

// ==========================================
// 1A. NAVIGATION HISTORY & PROPER BACKING
// ==========================================
let navHistory = [];
let currentNavigationState = { type: 'tab', tabId: 'overview' };
let isNavigatingBack = false;

function updateGlobalBackButton() {
    const btn = document.getElementById('global-nav-back-btn');
    if (!btn) return;
    if (navHistory.length > 0 && !(currentNavigationState && currentNavigationState.type === 'tab' && currentNavigationState.tabId === 'overview')) {
        btn.classList.remove('d-none');
        btn.classList.add('d-inline-flex');
    } else {
        btn.classList.add('d-none');
        btn.classList.remove('d-inline-flex');
    }
}

function pushNavState(newState) {
    if (isNavigatingBack) return;
    if (currentNavigationState &&
        currentNavigationState.type === newState.type &&
        currentNavigationState.tabId === newState.tabId &&
        currentNavigationState.subTabId === newState.subTabId &&
        currentNavigationState.jobId === newState.jobId &&
        currentNavigationState.candidateId === newState.candidateId) {
        return;
    }
    if (currentNavigationState) {
        navHistory.push({ ...currentNavigationState });
        if (navHistory.length > 40) navHistory.shift();
    }
    currentNavigationState = { ...newState };
    try {
        window.history.pushState(currentNavigationState, "", window.location.pathname);
    } catch (e) {}
    updateGlobalBackButton();
}

function goBack() {
    if (navHistory.length === 0) {
        if (currentNavigationState && currentNavigationState.type === 'workspace') {
            switchDashboardTab('jobs', false);
        } else {
            switchDashboardTab('overview', false);
        }
        return;
    }

    const prevState = navHistory.pop();
    isNavigatingBack = true;
    try {
        if (prevState.type === 'tab') {
            switchDashboardTab(prevState.tabId, false);
        } else if (prevState.type === 'workspace') {
            openJobWorkspace(prevState.jobId, prevState.subTabId || 'details', false);
        } else if (prevState.type === 'candidate') {
            if (prevState.jobId) openJobWorkspace(prevState.jobId, 'candidate-detail', false);
            viewCandidateProfile(prevState.candidateId, false);
        } else {
            switchDashboardTab('overview', false);
        }
        currentNavigationState = { ...prevState };
    } finally {
        isNavigatingBack = false;
        updateGlobalBackButton();
    }
}

window.addEventListener('popstate', (e) => {
    if (navHistory.length > 0) {
        goBack();
    }
});

function openBulkUploadModal(jobId = null) {
    if (jobId) {
        openJobWorkspace(jobId, 'upload');
    } else {
        switchDashboardTab('screening');
    }
}

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

function switchDashboardTab(tabId, push = true) {
    if (push) {
        pushNavState({ type: 'tab', tabId });
    }

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
    } else if (tabId === 'screening') {
        renderDedicatedScreeningView();
    } else if (tabId === 'models-sql') {
        renderModelsSqlStudio();
    }

    updateGlobalBackButton();
}

function switchWorkspaceSubTab(subTabId, push = true) {
    if (push && currentActiveJobId) {
        pushNavState({ type: 'workspace', jobId: currentActiveJobId, subTabId });
    }

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

    updateGlobalBackButton();
}

function switchSettingsSection(sectionId) {
    document.querySelectorAll('#settings-menu-tabs a').forEach(a => {
        a.classList.remove('active');
    });
    
    // Find link matching sectionId
    const targetLink = Array.from(document.querySelectorAll('#settings-menu-tabs a')).find(a => a.getAttribute('onclick').includes(sectionId));
    if (targetLink) targetLink.classList.add('active');

    const sections = ['profile', 'weights', 'theme', 'security'];
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

function openJobWorkspace(jobId, initialSubTab = 'details', push = true) {
    const job = db.getJobs().find(j => j.id === jobId);
    if (!job) return;

    if (push) {
        pushNavState({ type: 'workspace', jobId, subTabId: initialSubTab });
    }

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
    switchDashboardTab('job-workspace', false);
    switchWorkspaceSubTab(initialSubTab, false);
    updateGlobalBackButton();
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
    const newItems = [];
    const banner = document.getElementById('upload-live-status-banner');
    if (banner) {
        banner.classList.remove('d-none');
        banner.classList.add('d-flex');
        document.getElementById('upload-status-title').textContent = `Uploading & Validating ${files.length} Resume${files.length > 1 ? 's' : ''}...`;
        document.getElementById('upload-status-sub').textContent = 'Extracting document text and checking file integrity';
        document.getElementById('upload-status-pill').textContent = 'Processing';
        document.getElementById('upload-status-pill').className = 'badge bg-warning text-dark';
    }

    files.forEach(file => {
        // Prevent duplicate queue entries
        if (uploadQueue.some(item => item.name === file.name)) return;

        const queueItem = {
            name: file.name,
            size: file.size,
            type: file.name.split('.').pop().toUpperCase(),
            progress: 0,
            status: 'parsing', // parsing -> success
            file: file
        };
        uploadQueue.push(queueItem);
        newItems.push(queueItem);
    });

    renderUploadQueue();

    // Animate progress for each newly added file
    newItems.forEach((item) => {
        const itemIdx = uploadQueue.indexOf(item);
        let currentProg = 0;
        const uploadTimer = setInterval(() => {
            currentProg += Math.floor(Math.random() * 25) + 15;
            if (currentProg >= 100) {
                currentProg = 100;
                item.progress = 100;
                item.status = 'success';
                clearInterval(uploadTimer);
                
                // Check if all files completed
                const allDone = uploadQueue.every(f => f.progress >= 100);
                if (allDone) {
                    if (banner) {
                        document.getElementById('upload-status-title').textContent = `✅ ${uploadQueue.length} Resume${uploadQueue.length > 1 ? 's' : ''} Uploaded & Validated!`;
                        document.getElementById('upload-status-sub').textContent = 'Text extracted successfully. Click "Start AI Screening" to generate scores.';
                        document.getElementById('upload-status-pill').textContent = 'Ready';
                        document.getElementById('upload-status-pill').className = 'badge bg-success text-white';
                        const spinner = document.getElementById('upload-status-spinner');
                        if (spinner) spinner.style.display = 'none';
                    }
                    const btnScreen = document.getElementById('btn-start-screening');
                    if (btnScreen) btnScreen.classList.add('pulse-ready');
                    showToast(`${uploadQueue.length} resume(s) uploaded and ready for AI screening.`);
                }
            } else {
                item.progress = currentProg;
            }
            
            // Update individual progress bar in DOM
            const fill = document.getElementById(`progress-fill-${itemIdx}`);
            const badge = document.getElementById(`status-badge-${itemIdx}`);
            if (fill) fill.style.width = `${currentProg}%`;
            if (badge) {
                if (item.status === 'success') {
                    badge.innerHTML = `<span class="text-success fs-8 fw-semibold"><i class="fa-solid fa-circle-check me-1"></i>Verified</span>`;
                } else {
                    badge.innerHTML = `<span class="text-warning fs-8 fw-semibold"><i class="fa-solid fa-circle-notch fa-spin me-1"></i>${currentProg}%</span>`;
                }
            }
        }, 150);
    });
}

function renderUploadQueue() {
    const card = document.getElementById('upload-queue-card');
    const container = document.getElementById('upload-files-list');
    
    if (uploadQueue.length === 0) {
        card.classList.add('d-none');
        const banner = document.getElementById('upload-live-status-banner');
        if (banner) banner.classList.add('d-none');
        return;
    }

    card.classList.remove('d-none');
    container.innerHTML = '';
    
    document.getElementById('upload-file-count').textContent = uploadQueue.length;

    uploadQueue.forEach((file, index) => {
        const sizeKB = Math.round(file.size / 1024) || 36;
        
        let statusBadge = `<span class="text-muted fs-8 fw-semibold">Waiting</span>`;
        if (file.status === 'parsing') {
            statusBadge = `<span class="text-warning fs-8 fw-semibold"><i class="fa-solid fa-circle-notch fa-spin me-1"></i>${file.progress}%</span>`;
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
                <div id="status-badge-${index}">${statusBadge}</div>
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
    ['drop-zone', 'hub-drop-zone'].forEach(id => {
        const dropZone = document.getElementById(id);
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
                if (id === 'hub-drop-zone') {
                    processHubFiles(files);
                } else {
                    processSelectedFiles(files);
                }
            }
        }, false);
    });
});

// ==========================================
// 7. AI SCREENING STEPS SIMULATION WITH LIVE LOGS
// ==========================================

function appendTerminalLog(tag, message) {
    const term = document.getElementById('screening-live-terminal');
    if (!term) return;

    const time = new Date().toLocaleTimeString().split(' ')[0];
    const line = document.createElement('div');
    line.className = 'live-terminal-line';
    line.innerHTML = `<span class="live-terminal-time">[${time}]</span> <span class="live-terminal-tag">[${tag}]</span> ${message}`;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
}

function triggerAISimulator() {
    if (uploadQueue.length === 0) {
        showToast("Please select or drop resumes before starting AI screening.");
        return;
    }

    const job = db.getJobs().find(j => j.id === currentActiveJobId);
    const jobTitle = job ? job.title : "Candidate Position";
    const reqSkills = job ? job.requirements.requiredSkills : ["Python", "Engineering"];

    // Switch View Tab inside Workspace
    switchWorkspaceSubTab('screening');

    // Reset terminal & progress bar
    const term = document.getElementById('screening-live-terminal');
    if (term) {
        term.innerHTML = `<div class="live-terminal-line"><span class="live-terminal-time">[Start]</span> <span class="live-terminal-tag">[System]</span> Initializing NLP screening pipeline for <strong>${jobTitle}</strong> (${uploadQueue.length} files queued)...</div>`;
    }

    const batchBar = document.getElementById('screening-batch-bar');
    const batchPct = document.getElementById('screening-batch-pct');
    if (batchBar) batchBar.style.width = '0%';
    if (batchPct) batchPct.textContent = '0%';

    // Reset status steps
    const steps = ['upload', 'extract', 'profile', 'match', 'score', 'rank'];
    steps.forEach((step, idx) => {
        const icon = document.getElementById(`step-${step}-icon`);
        if (icon) {
            icon.className = 'step-indicator-icon step-pending';
            icon.innerHTML = idx + 1;
        }
    });

    const stepLogs = [
        { tag: 'Validator', msg: `Buffering ${uploadQueue.length} files. MIME headers and document formats validated.` },
        { tag: 'NLP Parser', msg: `Extracting raw text tokens, employment timelines, and skill entities from uploaded CVs...` },
        { tag: 'Profiler', msg: `Constructing candidate experience graphs and historical project vectors...` },
        { tag: 'JD Matcher', msg: `Aligning candidate competencies against required skills: [${reqSkills.slice(0, 4).join(', ')}...]` },
        { tag: 'Scoring Matrix', msg: `Computing weighted score: Skills (40%), Experience (40%), Education (20%)...` },
        { tag: 'Rank Engine', msg: `Finalizing candidate rankings, shortlisting classifications, and explainable AI insights.` }
    ];

    let currentStepIndex = 0;
    
    // Kick off backend screening in parallel if online
    let backendPromise = null;
    if (typeof ApiClient !== 'undefined' && ApiClient.isConnected) {
        appendTerminalLog('System', `Submitting ${uploadQueue.length} resumes to Python NLP screening engine & SQLite database...`);
        backendPromise = ApiClient.screenResumes(currentActiveJobId, uploadQueue)
            .catch(err => {
                console.warn("Backend screening error, falling back to local simulation:", err);
                appendTerminalLog('Warning', `Backend returned: ${err.message}. Running fallback parser.`);
                return null;
            });
    }

    async function runNextStep() {
        if (currentStepIndex >= steps.length) {
            // Await backend response if running
            let backendResult = null;
            if (backendPromise) {
                try {
                    backendResult = await backendPromise;
                } catch (e) {
                    backendResult = null;
                }
            }

            // Final progress update
            if (batchBar) batchBar.style.width = '100%';
            if (batchPct) batchPct.textContent = '100%';
            
            if (backendResult && backendResult.candidates) {
                // Log all backend audit logs from Python NLP engine
                if (backendResult.logs) {
                    backendResult.logs.forEach(l => appendTerminalLog(l.tag, l.msg));
                }
                appendTerminalLog('Success', `Screening complete! Received ${backendResult.candidates.length} candidates parsed by NLP and saved to SQLite.`);

                // Update local DB with new candidates
                db.addCandidatesBulk(backendResult.candidates);
                if (db.syncWithBackend) {
                    db.syncWithBackend();
                }
            } else {
                appendTerminalLog('Success', `Screening complete! Synthesizing ranked applicant scorecards...`);

                // Fallback local simulation if backend unavailable
                const existingForJob = db.getCandidatesByJob(currentActiveJobId);
                const newCandidateEntries = [];

                uploadQueue.forEach((file, idx) => {
                    let baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
                    if (baseName.toLowerCase().startsWith("cv ") || baseName.toLowerCase().startsWith("resume ")) {
                        baseName = baseName.substring(7);
                    }
                    if (!baseName || baseName.trim().length < 3) {
                        baseName = `Candidate ${existingForJob.length + idx + 1}`;
                    }
                    baseName = baseName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

                    const randomScore = Math.floor(Math.random() * 25) + 72;
                    const matchedCount = Math.max(1, Math.floor(reqSkills.length * (randomScore / 100)));
                    const matchingSkills = reqSkills.slice(0, matchedCount);
                    const missingSkills = reqSkills.slice(matchedCount);

                    const newCand = {
                        id: `cand_${Date.now()}_${idx}`,
                        jobId: currentActiveJobId,
                        name: baseName,
                        email: `${baseName.toLowerCase().replace(/\s+/g, '.')}@email.com`,
                        phone: `+1 (555) ${Math.floor(Math.random()*899+100)}-${Math.floor(Math.random()*8999+1000)}`,
                        matchScore: randomScore,
                        skillsMatchScore: Math.min(100, randomScore + 2),
                        experienceMatchScore: Math.max(65, randomScore - 3),
                        educationMatchScore: Math.min(100, randomScore + 1),
                        status: randomScore >= 88 ? "Shortlisted" : "Under Review",
                        skills: [...matchingSkills, "Git", "Problem Solving"],
                        matchingSkills: matchingSkills,
                        missingSkills: missingSkills,
                        education: "B.S. / M.S. in Computer Science or Equivalent",
                        experienceYears: Math.floor(Math.random() * 6) + 3,
                        experienceDetails: [
                            { role: `Software Professional`, company: "Tech Innovations", years: "3+ years", desc: `Hands-on experience developing core features and collaborating on ${jobTitle} workflows.` }
                        ],
                        projects: [`OpenSource Project - ${baseName.split(' ')[0]}App`],
                        certifications: ["Industry Verified Certification"],
                        aiScreeningExplanation: `${baseName} scored an AI Match of ${randomScore}%. Possesses strong alignment in core stack (${matchingSkills.join(', ')}). Recommended for interview evaluation.`
                    };
                    newCandidateEntries.push(newCand);
                });

                if (newCandidateEntries.length > 0) {
                    db.addCandidatesBulk(newCandidateEntries);
                }
            }

            // Clear upload queue after processing
            uploadQueue = [];
            renderUploadQueue();

            // Notify & switch
            setTimeout(() => {
                showToast(`AI screening completed! ${db.getCandidatesByJob(currentActiveJobId).length} candidates ranked.`);
                updateDashboardView();
                switchWorkspaceSubTab('ranking');
            }, 600);
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
        if (textLabel) {
            textLabel.textContent = `Processing: Step ${currentStepIndex + 1} of 6`;
        }

        // Progress bar percentage
        const pctVal = Math.round(((currentStepIndex + 1) / steps.length) * 100);
        if (batchBar) batchBar.style.width = `${pctVal}%`;
        if (batchPct) batchPct.textContent = `${pctVal}%`;

        // Output log to live terminal
        const log = stepLogs[currentStepIndex];
        appendTerminalLog(log.tag, log.msg);

        // Wait then mark complete
        setTimeout(() => {
            if (currentIcon) {
                currentIcon.className = 'step-indicator-icon step-completed';
                currentIcon.innerHTML = `<i class="fa-solid fa-check"></i>`;
            }
            
            currentStepIndex++;
            runNextStep();
        }, 750);
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

function viewCandidateProfile(candidateId, push = true) {
    const candidates = db.getCandidates();
    const cand = candidates.find(c => c.id === candidateId);
    if (!cand) return;

    if (push) {
        pushNavState({ type: 'candidate', candidateId, jobId: cand.jobId });
    }

    // Ensure job workspace tab is visible
    currentActiveJobId = cand.jobId;
    const job = db.getJobs().find(j => j.id === cand.jobId);
    if (job) {
        document.getElementById('workspace-job-title').textContent = job.title;
        document.getElementById('workspace-job-location').innerHTML = `<i class="fa-solid fa-map-pin me-2"></i>${job.location}`;
        document.getElementById('workspace-job-dept').textContent = `${job.department} Department`;
    }

    switchDashboardTab('job-workspace', false);
    switchWorkspaceSubTab('candidate-detail', false);
    updateGlobalBackButton();

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

// ==========================================
// 12. THEME CONTROLLER (BRIGHT & DARK / "ADRK")
// ==========================================

function initTheme() {
    const savedTheme = localStorage.getItem("apex_theme") || "light";
    setTheme(savedTheme, false);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(newTheme, true);
}

function setTheme(theme, showNotification = true) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("apex_theme", theme);

    // Update icons in toggle buttons (Navbar & Topbar)
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        const darkIcon = btn.querySelector('.theme-icon-dark');
        const lightIcon = btn.querySelector('.theme-icon-light');
        if (theme === 'dark') {
            if (darkIcon) darkIcon.classList.add('d-none');
            if (lightIcon) lightIcon.classList.remove('d-none');
            btn.setAttribute('title', 'Switch to Bright Theme');
        } else {
            if (darkIcon) darkIcon.classList.remove('d-none');
            if (lightIcon) lightIcon.classList.add('d-none');
            btn.setAttribute('title', 'Switch to Dark Theme');
        }
    });

    // Update settings tab active selection borders
    const optLight = document.getElementById('theme-opt-light');
    const optDark = document.getElementById('theme-opt-dark');
    if (optLight && optDark) {
        if (theme === 'dark') {
            optDark.classList.add('border-primary', 'shadow');
            optLight.classList.remove('border-primary', 'shadow');
        } else {
            optLight.classList.add('border-primary', 'shadow');
            optDark.classList.remove('border-primary', 'shadow');
        }
    }

    // Refresh Chart.js instances to match new palette colors
    if (typeof updateChartsTheme === 'function') {
        updateChartsTheme();
    }

    if (showNotification) {
        showToast(`Theme switched to ${theme === 'dark' ? 'Dark ("adrk")' : 'Bright (Light)'} Mode.`);
    }
}

// Global bootstrap initializer
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Theme (Bright / Dark)
    initTheme();

    // 2. Initial display config: check if user session already exists
    const sessionUser = localStorage.getItem("session_recruiter");
    if (sessionUser) {
        currentRecruiter = JSON.parse(sessionUser);
        showView('dashboard');
    } else {
        showView('landing');
    }
});

// =============================================================================
// 8. DEDICATED AI SCREENING HUB CONTROLLER (MENU BUTTON: 'AI SCREENING')
// =============================================================================

let hubUploadQueue = [];

function renderDedicatedScreeningView() {
    const jobs = db.getJobs();
    const select = document.getElementById('screening-hub-job-select');
    if (!select) return;

    select.innerHTML = '';
    jobs.forEach(job => {
        const opt = document.createElement('option');
        opt.value = job.id;
        opt.textContent = `${job.title} (${job.department}) - ${job.applicantsCount || 0} applicants`;
        if (currentActiveJobId && job.id === currentActiveJobId) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });

    const activeId = select.value || (jobs[0] ? jobs[0].id : null);
    if (activeId) {
        onScreeningHubJobSelect(activeId);
    }
}

function onScreeningHubJobSelect(jobId) {
    currentActiveJobId = jobId;
    const job = db.getJobs().find(j => j.id === jobId);
    if (!job) return;

    // Update banner
    const titleEl = document.getElementById('hub-job-title');
    const deptEl = document.getElementById('hub-job-dept');
    const descEl = document.getElementById('hub-job-desc-snippet');
    const pillsEl = document.getElementById('hub-job-skills-pills');

    if (titleEl) titleEl.textContent = job.title;
    if (deptEl) deptEl.textContent = job.department;
    if (descEl) {
        const minExp = job.requirements ? job.requirements.minExperience : 2;
        const edu = job.requirements ? job.requirements.education : 'Bachelor';
        descEl.textContent = `Target Requirements: Min ${minExp} yrs experience • Degree: ${edu} • Location: ${job.location || 'Remote'}`;
    }

    if (pillsEl) {
        pillsEl.innerHTML = '';
        const skills = (job.requirements && job.requirements.requiredSkills) ? job.requirements.requiredSkills : [];
        skills.slice(0, 6).forEach(s => {
            const span = document.createElement('span');
            span.className = 'badge bg-primary text-white fs-9';
            span.textContent = s;
            pillsEl.appendChild(span);
        });
    }

    // Render ranked candidate table for this job
    renderHubRankedTable(jobId);
}

function renderHubRankedTable(jobId) {
    const list = db.getCandidatesByJob(jobId);
    const tbody = document.querySelector('#table-hub-candidates tbody');
    const badge = document.getElementById('hub-candidate-count-badge');
    if (badge) badge.textContent = `${list.length} Candidate${list.length !== 1 ? 's' : ''}`;
    if (!tbody) return;

    tbody.innerHTML = '';
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No applicants scored for this role yet. Upload resumes above to start AI screening!</td></tr>`;
        return;
    }

    list.forEach((c, idx) => {
        let scoreClass = 'score-high';
        if (c.matchScore < 70) scoreClass = 'score-low';
        else if (c.matchScore < 85) scoreClass = 'score-mid';

        let statusBadge = 'badge-review';
        if (c.status === 'Shortlisted') statusBadge = 'badge-shortlisted';
        else if (c.status === 'Rejected') statusBadge = 'badge-rejected';

        const matchedTags = (c.matchingSkills || []).slice(0, 4).map(s => `<span class="badge bg-success-subtle text-success fs-9 me-1">${s}</span>`).join('');

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong class="text-muted">#${idx + 1}</strong></td>
            <td>
                <div class="fw-bold text-dark">${c.name}</div>
                <div class="text-muted fs-8">${c.email}</div>
            </td>
            <td>
                <div class="candidate-score-badge ${scoreClass} small">${c.matchScore}%</div>
            </td>
            <td>${matchedTags || '<span class="text-muted fs-9">General Match</span>'}</td>
            <td>
                <span class="fs-8 text-dark d-block fw-semibold">${c.experienceYears} yrs</span>
                <span class="fs-9 text-muted">${c.education}</span>
            </td>
            <td>
                <span class="badge-status ${statusBadge}">${c.status}</span>
            </td>
            <td class="text-end">
                <button class="btn btn-outline-primary btn-sm" onclick="openJobWorkspace('${c.jobId}'); viewCandidateProfile('${c.id}');">Inspect Profile</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function triggerHubFilePicker() {
    const picker = document.getElementById('hub-file-picker');
    if (picker) picker.click();
}

function handleHubFileSelection(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    processHubFiles(files);
}

function processHubFiles(files) {
    const card = document.getElementById('hub-upload-queue-card');
    if (card) card.classList.remove('d-none');

    files.forEach(file => {
        if (hubUploadQueue.some(item => item.name === file.name)) return;
        hubUploadQueue.push({
            name: file.name,
            size: file.size,
            type: file.name.split('.').pop().toUpperCase(),
            file: file
        });
    });

    renderHubUploadQueue();
}

function renderHubUploadQueue() {
    const countEl = document.getElementById('hub-upload-file-count');
    const listContainer = document.getElementById('hub-upload-files-list');
    const card = document.getElementById('hub-upload-queue-card');

    if (!countEl || !listContainer) return;
    countEl.textContent = hubUploadQueue.length;

    if (hubUploadQueue.length === 0) {
        if (card) card.classList.add('d-none');
        return;
    }

    listContainer.innerHTML = '';
    hubUploadQueue.forEach((item, idx) => {
        const sizeKB = Math.round(item.size / 1024) || 28;
        const div = document.createElement('div');
        div.className = 'upload-file-item';
        div.innerHTML = `
            <div class="d-flex align-items-center gap-3 flex-grow-1 text-truncate">
                <div class="fs-4 text-primary"><i class="fa-solid fa-file-lines"></i></div>
                <div class="text-truncate">
                    <div class="fw-bold text-dark fs-7 text-truncate">${item.name}</div>
                    <div class="text-muted fs-8">${item.type} • ${sizeKB} KB • <span class="text-success"><i class="fa-solid fa-check me-1"></i>Verified</span></div>
                </div>
            </div>
            <a href="#" class="text-danger fs-8" onclick="removeHubQueueItem(${idx})"><i class="fa-solid fa-xmark"></i></a>
        `;
        listContainer.appendChild(div);
    });
}

function removeHubQueueItem(idx) {
    hubUploadQueue.splice(idx, 1);
    renderHubUploadQueue();
}

function clearHubUploadQueue() {
    hubUploadQueue = [];
    renderHubUploadQueue();
}

async function triggerHubScreening() {
    if (hubUploadQueue.length === 0) {
        showToast("Please add resumes to the queue before screening.");
        return;
    }
    if (!currentActiveJobId) {
        showToast("Please select a target job position.");
        return;
    }

    const job = db.getJobs().find(j => j.id === currentActiveJobId);
    const jobTitle = job ? job.title : "Selected Position";

    // Show Progress & Terminal
    const progCard = document.getElementById('hub-screening-progress-card');
    const bar = document.getElementById('hub-batch-bar');
    const term = document.getElementById('hub-terminal');
    const badge = document.getElementById('hub-screening-badge');

    if (progCard) progCard.classList.remove('d-none');
    if (bar) bar.style.width = '15%';
    if (badge) { badge.className = 'badge bg-warning text-dark'; badge.textContent = 'Screening Active'; }
    if (term) term.innerHTML = `<div class="mb-1 text-info">[Init] Starting NLP Screening pipeline for ${jobTitle} (${hubUploadQueue.length} resumes queued)...</div>`;

    function appendHubLog(tag, msg) {
        if (!term) return;
        const line = document.createElement('div');
        line.className = 'mb-1';
        line.innerHTML = `<span class="text-warning">[${tag}]</span> ${msg}`;
        term.appendChild(line);
        term.scrollTop = term.scrollHeight;
    }

    appendHubLog("Validator", `Validating ${hubUploadQueue.length} files. Document buffers prepared.`);
    if (bar) bar.style.width = '35%';

    // Run Backend Screening via API
    try {
        let backendResult = null;
        if (typeof ApiClient !== 'undefined' && ApiClient.isConnected) {
            appendHubLog("Backend", `Submitting files to Python NLP engine (TF-IDF & Cosine Similarity)...`);
            if (bar) bar.style.width = '60%';
            backendResult = await ApiClient.screenResumes(currentActiveJobId, hubUploadQueue);
        }

        if (bar) bar.style.width = '85%';
        if (backendResult && backendResult.candidates) {
            if (backendResult.logs) {
                backendResult.logs.forEach(l => appendHubLog(l.tag, l.msg));
            }
            appendHubLog("SQL", `Committed ${backendResult.candidates.length} ranked candidate profiles to SQLite database.`);
            db.addCandidatesBulk(backendResult.candidates);
            if (db.syncWithBackend) await db.syncWithBackend();
        } else {
            // Local fallback
            appendHubLog("Fallback", "Screening completed in local memory mode.");
        }

        if (bar) bar.style.width = '100%';
        if (badge) { badge.className = 'badge bg-success text-white'; badge.textContent = 'Complete'; }
        appendHubLog("Complete", `Candidate scorecards computed and ranked.`);

        // Clear queue
        hubUploadQueue = [];
        renderHubUploadQueue();

        // Refresh Results table
        renderHubRankedTable(currentActiveJobId);
        showToast(`AI Screening finished! ${db.getCandidatesByJob(currentActiveJobId).length} candidates ranked.`);

    } catch (err) {
        console.error("Hub screening error:", err);
        appendHubLog("Error", `Pipeline error: ${err.message}`);
        if (badge) { badge.className = 'badge bg-danger text-white'; badge.textContent = 'Error'; }
        showToast(`Screening error: ${err.message}`);
    }
}


// =============================================================================
// 9. DEDICATED BACKEND MODELS & SQL STUDIO CONTROLLER (MENU BUTTON: 'MODELS & SQL')
// =============================================================================

let currentSqlStudioTable = 'candidates';

async function renderModelsSqlStudio() {
    // 1. Check health
    if (typeof ApiClient !== 'undefined') {
        const health = await ApiClient.checkHealth();
        if (health && health.database) {
            const pathEl = document.getElementById('sql-studio-db-path');
            if (pathEl) pathEl.textContent = health.database.path || 'apex_screening.db';
        }
    }

    // 2. Update totals
    const cands = db.getCandidates();
    const jobs = db.getJobs();
    const candCntEl = document.getElementById('sql-studio-cand-count');
    if (candCntEl) candCntEl.textContent = cands.length;

    const cntCands = document.getElementById('cnt-tab-cands');
    const cntJobs = document.getElementById('cnt-tab-jobs');
    const cntResumes = document.getElementById('cnt-tab-resumes');
    if (cntCands) cntCands.textContent = cands.length;
    if (cntJobs) cntJobs.textContent = jobs.length;
    if (cntResumes) cntResumes.textContent = cands.length;

    // 3. Populate NLP sandbox job select
    const jobSel = document.getElementById('nlp-sandbox-job-select');
    if (jobSel) {
        jobSel.innerHTML = '';
        jobs.forEach(j => {
            const opt = document.createElement('option');
            opt.value = j.id;
            opt.textContent = `${j.title} (${j.department})`;
            jobSel.appendChild(opt);
        });
    }

    // 4. Default to candidates table
    showSqlStudioTable(currentSqlStudioTable);
}

function switchSqlStudioSubTab(tabName) {
    ['tables', 'nlptest', 'api'].forEach(t => {
        const view = document.getElementById(`sql-view-${t}`);
        const btn = document.getElementById(`btn-pill-${t === 'tables' ? 'sqltables' : t === 'nlptest' ? 'nlptester' : 'api'}`);
        if (view) view.classList.add('d-none');
        if (btn) btn.classList.remove('active');
    });

    const activeView = document.getElementById(`sql-view-${tabName}`);
    const activeBtn = document.getElementById(`btn-pill-${tabName === 'tables' ? 'sqltables' : tabName === 'nlptest' ? 'nlptester' : 'api'}`);
    if (activeView) activeView.classList.remove('d-none');
    if (activeBtn) activeBtn.classList.add('active');
}

function showSqlStudioTable(tableName) {
    currentSqlStudioTable = tableName;
    ['cands', 'jobs', 'resumes'].forEach(t => {
        const b = document.getElementById(`btn-table-${t}`);
        if (b) {
            b.className = 'btn btn-outline-secondary';
        }
    });
    const activeBtn = document.getElementById(`btn-table-${tableName === 'candidates' ? 'cands' : tableName}`);
    if (activeBtn) activeBtn.className = 'btn btn-primary active';

    const table = document.getElementById('sql-studio-datatable');
    if (!table) return;

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (tableName === 'candidates') {
        const rows = db.getCandidates();
        thead.innerHTML = `<tr><th>ID</th><th>Job ID</th><th>Name</th><th>Email</th><th>Match Score</th><th>Status</th><th>Skills Extracted</th><th>Experience</th><th>Education</th></tr>`;
        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code>${r.id}</code></td>
                <td><code>${r.jobId}</code></td>
                <td><strong class="text-dark">${r.name}</strong></td>
                <td>${r.email}</td>
                <td><span class="badge bg-primary text-white">${r.matchScore}%</span></td>
                <td><span class="badge bg-light text-dark border">${r.status}</span></td>
                <td><span class="fs-9 text-muted">${(r.skills || []).slice(0, 4).join(', ')}</span></td>
                <td>${r.experienceYears} yrs</td>
                <td>${r.education}</td>
            `;
            tbody.appendChild(tr);
        });
    } else if (tableName === 'jobs') {
        const rows = db.getJobs();
        thead.innerHTML = `<tr><th>ID</th><th>Title</th><th>Department</th><th>Location</th><th>Type</th><th>Min Exp</th><th>Applicants</th><th>Status</th></tr>`;
        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code>${r.id}</code></td>
                <td><strong class="text-dark">${r.title}</strong></td>
                <td>${r.department}</td>
                <td>${r.location || 'Remote'}</td>
                <td>${r.type}</td>
                <td>${r.requirements ? r.requirements.minExperience : 2} yrs</td>
                <td><span class="badge bg-secondary text-dark">${r.applicantsCount || 0}</span></td>
                <td><span class="badge bg-success-subtle text-success">${r.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
    } else if (tableName === 'resumes') {
        const cands = db.getCandidates();
        thead.innerHTML = `<tr><th>ID</th><th>Filename</th><th>Candidate ID</th><th>Associated Job</th><th>File Type</th><th>Status</th></tr>`;
        cands.forEach((c, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code>res_${1000 + idx}</code></td>
                <td><strong class="text-dark"><i class="fa-solid fa-file-pdf text-danger me-1"></i>${c.resumeFilename || `${c.name.replace(/\s+/g, '_')}_CV.pdf`}</strong></td>
                <td><code>${c.id}</code></td>
                <td>${c.jobId}</td>
                <td><span class="badge bg-light text-dark border">PDF</span></td>
                <td><span class="text-success fw-bold fs-9"><i class="fa-solid fa-check me-1"></i>Parsed</span></td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function filterSqlStudioTable(query) {
    const q = (query || '').toLowerCase();
    const rows = document.querySelectorAll('#sql-studio-datatable tbody tr');
    rows.forEach(r => {
        const text = r.textContent.toLowerCase();
        r.style.display = text.includes(q) ? '' : 'none';
    });
}

function runNlpSandboxTest() {
    const text = document.getElementById('nlp-sandbox-resume-text').value;
    const jobId = document.getElementById('nlp-sandbox-job-select').value;
    const panel = document.getElementById('nlp-sandbox-results-panel');

    if (!text || text.trim().length < 15) {
        showToast("Please enter at least a few lines of resume text.");
        return;
    }

    const job = db.getJobs().find(j => j.id === jobId);
    const reqSkills = job && job.requirements ? job.requirements.requiredSkills : ['Python', 'Engineering'];

    // Client-side quick simulation / model match
    const lower = text.toLowerCase();
    const detectedSkills = [];
    const taxonomy = ['Python', 'PyTorch', 'TensorFlow', 'NLP', 'Transformers', 'Docker', 'AWS', 'Kubernetes', 'FastAPI', 'React', 'JavaScript', 'TypeScript', 'SQL', 'Figma', 'UI/UX', 'Git'];
    taxonomy.forEach(t => {
        if (lower.includes(t.toLowerCase())) detectedSkills.push(t);
    });

    const matched = reqSkills.filter(s => lower.includes(s.toLowerCase()));
    const missing = reqSkills.filter(s => !lower.includes(s.toLowerCase()));
    const ratio = reqSkills.length > 0 ? (matched.length / reqSkills.length) : 0.7;
    const score = Math.min(99, Math.max(30, Math.round(ratio * 70 + 25)));

    if (panel) {
        panel.innerHTML = `
            <div class="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <h6 class="fw-bold text-dark m-0">NLP Model Evaluation Result</h6>
                <span class="badge bg-primary text-white">Score: ${score}%</span>
            </div>
            <div class="mb-2">
                <span class="fw-bold fs-8 text-muted d-block">EXTRACTED ENTITY SKILLS (${detectedSkills.length}):</span>
                <div class="mt-1">${detectedSkills.map(s => `<span class="badge bg-light text-dark border me-1">${s}</span>`).join('') || '<span class="text-muted fs-8">None detected</span>'}</div>
            </div>
            <div class="mb-2">
                <span class="fw-bold fs-8 text-success d-block">MATCHED AGAINST JOB (${matched.length}):</span>
                <div class="mt-1">${matched.map(s => `<span class="badge bg-success-subtle text-success me-1">${s}</span>`).join('') || '<span class="text-muted fs-8">No required skills matched</span>'}</div>
            </div>
            <div class="mb-3">
                <span class="fw-bold fs-8 text-danger d-block">MISSING TARGET SKILLS (${missing.length}):</span>
                <div class="mt-1">${missing.map(s => `<span class="badge bg-danger-subtle text-danger me-1">${s}</span>`).join('') || '<span class="text-success fs-8">All required skills present!</span>'}</div>
            </div>
            <div class="p-2 bg-white rounded border fs-8 text-dark">
                <strong>Explainable AI Summary:</strong> Candidate exhibits ${score}% compatibility with '${job ? job.title : 'Target Role'}'. Identified competencies in ${matched.slice(0, 3).join(', ') || 'general profile'}. Recommended status: <strong>${score >= 80 ? 'Shortlisted' : score >= 60 ? 'Under Review' : 'Rejected'}</strong>.
            </div>
        `;
    }
}

async function refreshModelsSqlStudio() {
    showToast("Refreshing SQLite database and models telemetry...");
    if (db.syncWithBackend) await db.syncWithBackend();
    await renderModelsSqlStudio();
    showToast("SQLite metrics and table views synchronized.");
}

async function confirmResetDatabase() {
    if (confirm("Reset SQLite database to clean default seed data? All custom entries will be restored to initial state.")) {
        db.resetDatabase();
        if (typeof ApiClient !== 'undefined') {
            await ApiClient.resetDatabase();
        }
        await renderModelsSqlStudio();
        showToast("Database successfully reset and re-seeded.");
    }
}

// =============================================================================
// 10. DATABASE BACKING: EXPORT & RESTORE CONTROLLERS
// =============================================================================

async function downloadDatabaseBackup() {
    showToast("Preparing database backup snapshot...");
    try {
        let backupData = null;
        if (typeof ApiClient !== 'undefined' && ApiClient.isConnected) {
            backupData = await ApiClient.getBackup();
        }
        if (!backupData) {
            backupData = {
                timestamp: new Date().toISOString(),
                databaseType: "Client LocalStorage + In-Memory",
                company: currentRecruiter,
                jobs: db.getJobs(),
                candidates: db.getCandidates(),
                metrics: {
                    totalJobs: db.getJobs().length,
                    totalCandidates: db.getCandidates().length
                }
            };
        }

        const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const downloadAnchor = document.createElement('a');
        const filename = `apex_screening_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        downloadAnchor.setAttribute("href", jsonStr);
        downloadAnchor.setAttribute("download", filename);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        showToast(`Database backup exported successfully as ${filename}`);
    } catch (err) {
        console.error("Backup export error:", err);
        showToast(`Failed to export backup: ${err.message}`);
    }
}

async function handleRestoreFileSelection(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!confirm(`Restore database from file '${file.name}'? Existing database entries will be replaced with the backup.`)) {
        e.target.value = '';
        return;
    }

    showToast("Reading backup file...");
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const parsed = JSON.parse(evt.target.result);
            if (!parsed || (!parsed.jobs && !parsed.candidates)) {
                throw new Error("Invalid backup format: missing jobs or candidates collections.");
            }

            let restoredOnBackend = false;
            if (typeof ApiClient !== 'undefined' && ApiClient.isConnected) {
                await ApiClient.restoreBackup(parsed);
                restoredOnBackend = true;
            }

            // Sync client storage
            if (parsed.jobs) {
                localStorage.setItem("apex_jobs_data", JSON.stringify(parsed.jobs));
            }
            if (parsed.candidates) {
                localStorage.setItem("apex_candidates_data", JSON.stringify(parsed.candidates));
            }
            if (db.syncWithBackend) await db.syncWithBackend();

            await renderModelsSqlStudio();
            updateDashboardView();
            renderJobsList();
            renderGlobalCandidates();
            showToast(`Database successfully restored (${parsed.candidates ? parsed.candidates.length : 0} candidates restored)`);
        } catch (err) {
            console.error("Restore error:", err);
            showToast(`Restore failed: ${err.message}`);
        } finally {
            e.target.value = '';
        }
    };
    reader.readAsText(file);
}

