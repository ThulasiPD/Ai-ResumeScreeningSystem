/**
 * Charting Utilities for Recruiter Dashboard Analytics
 * Uses Chart.js with our customized light theme brand palette.
 */

const BrandPalette = {
    primary: '#BB8644',
    primaryLight: '#E8B38C',
    sage: '#909E84',
    dark: '#75654C',
    yellow: '#E3D477',
    mutedGray: '#A0968C',
    border: '#EFE9E0',
    font: "'Plus Jakarta Sans', sans-serif"
};

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
 * Initialize Overall Company Recruitment Dashboard Charts
 */
function renderCompanyAnalytics() {
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
                    backgroundColor: [BrandPalette.primary, BrandPalette.sage, BrandPalette.primaryLight],
                    borderRadius: 6,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { fontFamily: BrandPalette.font }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        grid: { color: BrandPalette.border }
                    },
                    x: {
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
                    borderColor: BrandPalette.primary,
                    backgroundColor: 'rgba(187, 134, 68, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: BrandPalette.dark,
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
                        ticks: { stepSize: 1 },
                        grid: { color: BrandPalette.border }
                    },
                    x: {
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
                    backgroundColor: [BrandPalette.sage, BrandPalette.yellow, '#F87171'],
                    hoverOffset: 4,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: 'Plus Jakarta Sans', size: 11 }
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
                    backgroundColor: BrandPalette.primaryLight,
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
                        ticks: { stepSize: 1 },
                        grid: { color: BrandPalette.border }
                    },
                    y: {
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
                    backgroundColor: [BrandPalette.sage, BrandPalette.primaryLight, '#FCA5A5'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: 'Plus Jakarta Sans', size: 10 }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }
}
