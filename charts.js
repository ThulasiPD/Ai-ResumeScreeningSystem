/**
 * Charting Utilities for Recruiter Dashboard Analytics
 * Supports Dynamic Theme Switching (Bright / Dark "adrk")
 */

function getPalette() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
        primary: isDark ? '#E5A45D' : '#BB8644',
        primaryLight: isDark ? '#F4C7A1' : '#E8B38C',
        sage: isDark ? '#A4B697' : '#909E84',
        dark: isDark ? '#F3ECE2' : '#75654C',
        yellow: isDark ? '#F0E38B' : '#E3D477',
        mutedGray: isDark ? '#A89F95' : '#A0968C',
        border: isDark ? 'rgba(255, 255, 255, 0.1)' : '#EFE9E0',
        textColor: isDark ? '#EDE7E1' : '#2D2721',
        font: "'Plus Jakarta Sans', sans-serif"
    };
}

// Global chart storage to allow destroying before recreating (prevents canvas hover glitches)
let activeCharts = {};

/**
 * Destroy a chart if it already exists
 */
function destroyChart(id) {
    if (activeCharts[id]) {
        activeCharts[id].destroy();
        delete activeCharts[id];
    }
}

/**
 * Re-render all active charts when theme changes
 */
function updateChartsTheme() {
    const activeTabLink = document.querySelector('.sidebar-link.active');
    if (!activeTabLink) return;

    const tabId = activeTabLink.id.replace('side-', '');
    if (tabId === 'overview' || tabId === 'analytics') {
        renderCompanyAnalytics();
        if (typeof renderGlobalAnalyticsAlternative === 'function') {
            renderGlobalAnalyticsAlternative();
        }
    } else if (tabId === 'job-workspace' && typeof currentActiveJobId !== 'undefined' && currentActiveJobId) {
        renderJobAnalytics(currentActiveJobId);
    }
}

/**
 * Initialize Overall Company Recruitment Dashboard Charts
 */
function renderCompanyAnalytics() {
    const pal = getPalette();
    const jobs = db.getJobs();
    const candidates = db.getCandidates();

    // 1. Job-Wise Applicants (Bar Chart)
    const jobLabels = jobs.map(j => j.title.substring(0, 18) + (j.title.length > 18 ? '...' : ''));
    const jobApplicantCounts = jobs.map(j => db.getCandidatesByJob(j.id).length);

    destroyChart('chart-job-applicants');
    const ctx1 = document.getElementById('chart-job-applicants');
    if (ctx1) {
        activeCharts['chart-job-applicants'] = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: jobLabels,
                datasets: [{
                    label: 'Applicants',
                    data: jobApplicantCounts,
                    backgroundColor: [pal.primary, pal.sage, pal.primaryLight],
                    borderRadius: 6,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { fontFamily: pal.font }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, color: pal.textColor },
                        grid: { color: pal.border }
                    },
                    x: {
                        ticks: { color: pal.textColor },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // 2. Candidate Match Score Distribution (Line Chart)
    const scoreRanges = ['<60%', '60-70%', '70-80%', '80-90%', '90-100%'];
    const scoreCounts = [0, 0, 0, 0, 0];
    candidates.forEach(c => {
        if (c.matchScore < 60) scoreCounts[0]++;
        else if (c.matchScore < 70) scoreCounts[1]++;
        else if (c.matchScore < 80) scoreCounts[2]++;
        else if (c.matchScore < 90) scoreCounts[3]++;
        else scoreCounts[4]++;
    });

    destroyChart('chart-score-distribution');
    const ctx2 = document.getElementById('chart-score-distribution');
    if (ctx2) {
        activeCharts['chart-score-distribution'] = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: scoreRanges,
                datasets: [{
                    label: 'Candidates count',
                    data: scoreCounts,
                    borderColor: pal.primary,
                    backgroundColor: 'rgba(229, 164, 93, 0.15)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: pal.primary,
                    pointBorderColor: '#fff',
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, color: pal.textColor },
                        grid: { color: pal.border }
                    },
                    x: {
                        ticks: { color: pal.textColor },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // 3. Recruitment Pipeline Funnel (Doughnut Chart)
    const shortlistedCount = candidates.filter(c => c.status === 'Shortlisted').length;
    const reviewCount = candidates.filter(c => c.status === 'Under Review').length;
    const rejectedCount = candidates.filter(c => c.status === 'Rejected').length;

    destroyChart('chart-pipeline-funnel');
    const ctx3 = document.getElementById('chart-pipeline-funnel');
    if (ctx3) {
        activeCharts['chart-pipeline-funnel'] = new Chart(ctx3, {
            type: 'doughnut',
            data: {
                labels: ['Shortlisted', 'Under Review', 'Rejected'],
                datasets: [{
                    data: [shortlistedCount, reviewCount, rejectedCount],
                    backgroundColor: [pal.sage, pal.yellow, '#F87171'],
                    hoverOffset: 4,
                    borderWidth: 2,
                    borderColor: pal.border
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: 'Plus Jakarta Sans', size: 11 },
                            color: pal.textColor
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }
}

/**
 * Initialize Analytics Specific to a Selected Job
 */
function renderJobAnalytics(jobId) {
    const pal = getPalette();
    const jobCandidates = db.getCandidatesByJob(jobId);

    // 1. Skill Match Frequency (Horizontal Bar Chart)
    const job = db.getJobs().find(j => j.id === jobId);
    if (!job) return;

    const allRequiredSkills = job.requirements.requiredSkills;
    const skillCounts = {};
    allRequiredSkills.forEach(s => skillCounts[s] = 0);

    jobCandidates.forEach(c => {
        c.skills.forEach(s => {
            if (allRequiredSkills.includes(s)) {
                skillCounts[s]++;
            }
        });
    });

    destroyChart('chart-job-skills');
    const ctx1 = document.getElementById('chart-job-skills');
    if (ctx1) {
        activeCharts['chart-job-skills'] = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: Object.keys(skillCounts),
                datasets: [{
                    label: 'Candidates possessing skill',
                    data: Object.values(skillCounts),
                    backgroundColor: pal.primaryLight,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, color: pal.textColor },
                        grid: { color: pal.border }
                    },
                    y: {
                        ticks: { color: pal.textColor },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // 2. Score spread segment (Doughnut)
    let high = 0, med = 0, low = 0;
    jobCandidates.forEach(c => {
        if (c.matchScore >= 85) high++;
        else if (c.matchScore >= 70) med++;
        else low++;
    });

    destroyChart('chart-job-score-spread');
    const ctx2 = document.getElementById('chart-job-score-spread');
    if (ctx2) {
        activeCharts['chart-job-score-spread'] = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['High Fit (85%+)', 'Medium Fit (70-84%)', 'Low Fit (<70%)'],
                datasets: [{
                    data: [high, med, low],
                    backgroundColor: [pal.sage, pal.primaryLight, '#FCA5A5'],
                    borderWidth: 2,
                    borderColor: pal.border
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: 'Plus Jakarta Sans', size: 10 },
                            color: pal.textColor
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }
}

