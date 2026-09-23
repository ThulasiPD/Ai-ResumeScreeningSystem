/**
 * Mock Database for Resume Screening System
 * Designed to simulate backend state in memory/localStorage.
 */

const INITIAL_COMPANIES = [
    {
        id: "comp_01",
        name: "Apex AI Solutions",
        domain: "apexai.com",
        size: "50-100",
        industry: "Software & Technology",
        plan: "Enterprise Pro"
    }
];

const INITIAL_JOBS = [
    {
        id: "job_01",
        title: "Senior AI/ML Engineer",
        department: "Engineering",
        location: "San Francisco, CA (Hybrid)",
        type: "Full-time",
        createdDate: "2026-08-10",
        status: "Active",
        applicantsCount: 6,
        description: "We are looking for a Senior AI/ML Engineer to build and scale our conversational AI pipelines. You will design, train, and deploy deep learning models, particularly large language models (LLMs), and integrate them into production cloud APIs.",
        requirements: {
            requiredSkills: ["Python", "PyTorch", "Transformers", "LLMs", "NLP", "Docker", "AWS"],
            preferredSkills: ["Kubernetes", "LangChain", "Vector Databases", "FastAPI"],
            minExperience: 5,
            education: "Master's or Ph.D. in Computer Science, Data Science, or related field",
            otherScreeningRules: "Must have experience deploying models to production with AWS/Docker."
        }
    },
    {
        id: "job_02",
        title: "Lead React Developer",
        department: "Frontend",
        location: "Remote (US)",
        type: "Full-time",
        createdDate: "2026-08-15",
        status: "Active",
        applicantsCount: 4,
        description: "Looking for a seasoned Frontend Engineer with deep React expertise. You will own the UI/UX architecture of our flagship recruiter workspace, optimize client-side performance, and mentor a small team of frontend developers.",
        requirements: {
            requiredSkills: ["React", "JavaScript", "TypeScript", "HTML5/CSS3", "Redux Toolkit", "Webpack"],
            preferredSkills: ["Next.js", "Tailwind CSS", "Bootstrap", "Jest/Cypress"],
            minExperience: 6,
            education: "Bachelor's in Computer Science or equivalent experience",
            otherScreeningRules: "Strong focus on state management and performance tuning."
        }
    },
    {
        id: "job_03",
        title: "Product Designer (UI/UX)",
        department: "Design",
        location: "New York, NY (On-site)",
        type: "Contract",
        createdDate: "2026-08-18",
        status: "Active",
        applicantsCount: 3,
        description: "Join us to shape the future of enterprise SaaS recruitment tools. You will lead user research, wireframe user flows, design high-fidelity components, and work closely with frontend engineers to deliver a cohesive product experience.",
        requirements: {
            requiredSkills: ["Figma", "UI/UX Design", "Wireframing", "Prototyping", "Design Systems"],
            preferredSkills: ["Webflow", "Adobe Creative Suite", "Usability Testing", "Basic HTML/CSS"],
            minExperience: 4,
            education: "Bachelor's in Design, HCI, or related field",
            otherScreeningRules: "Portfolio required demonstrating shipped SaaS products."
        }
    }
];

const INITIAL_CANDIDATES = [
    // Job 01 - Senior AI/ML Engineer
    {
        id: "cand_101",
        jobId: "job_01",
        name: "Dr. Aris Thorne",
        email: "aris.thorne@mlresearch.io",
        phone: "+1 (555) 321-7890",
        matchScore: 95,
        skillsMatchScore: 98,
        experienceMatchScore: 95,
        educationMatchScore: 90,
        status: "Shortlisted",
        skills: ["Python", "PyTorch", "Transformers", "LLMs", "NLP", "Docker", "AWS", "Kubernetes", "Vector Databases", "FastAPI", "C++"],
        matchingSkills: ["Python", "PyTorch", "Transformers", "LLMs", "NLP", "Docker", "AWS", "Kubernetes", "Vector Databases", "FastAPI"],
        missingSkills: [],
        education: "Ph.D. in Computer Science (Specialization in NLP) - Stanford University",
        experienceYears: 6,
        experienceDetails: [
            { role: "Senior ML Engineer", company: "NeuralFlow Labs", years: "3 years", desc: "Designed and optimized transformer-based LLMs. Built vector indexes for semantic search and reduced model inference latency by 40%." },
            { role: "AI Research Scientist", company: "Cognitive Labs", years: "3 years", desc: "Researched deep generative architectures, published at NeurIPS, and engineered containerized training runs on AWS cluster nodes." }
        ],
        projects: ["DocuMind: Open-source document QA chatbot", "FastGen: Low-latency inference engine for transformers"],
        certifications: ["AWS Certified Machine Learning - Specialty", "DeepLearning.AI Tensorflow Developer Certificate"],
        aiScreeningExplanation: "Dr. Thorne is an exceptional fit. He holds a Ph.D. directly focusing on NLP from Stanford and demonstrates over 6 years of robust ML engineering experience. He possesses 100% of the required technical stack, including Docker, AWS, and PyTorch, and matches advanced preferred skills such as Vector Databases and FastAPI. Strong recommendation for immediate technical interview."
    },
    {
        id: "cand_102",
        jobId: "job_01",
        name: "Elena Rostova",
        email: "elena.rostova@techcorp.com",
        phone: "+1 (555) 789-0123",
        matchScore: 88,
        skillsMatchScore: 92,
        experienceMatchScore: 85,
        educationMatchScore: 85,
        status: "Under Review",
        skills: ["Python", "PyTorch", "Transformers", "LLMs", "NLP", "AWS", "Docker", "Git", "SQL"],
        matchingSkills: ["Python", "PyTorch", "Transformers", "LLMs", "NLP", "AWS", "Docker"],
        missingSkills: ["Kubernetes", "LangChain"],
        education: "M.S. in Data Science - University of Michigan",
        experienceYears: 5,
        experienceDetails: [
            { role: "Machine Learning Engineer", company: "TechCorp Systems", years: "4 years", desc: "Developed NLP classifiers for sentiment tracking and customer ticket routing. Managed training pipelines using PyTorch on AWS Sagemaker." },
            { role: "Data Analyst", company: "DataSync Co", years: "1 year", desc: "Performed statistical analysis, engineered data pipelines, and maintained relational database schemas." }
        ],
        projects: ["SentimentPulse: Real-time Twitter analysis engine", "LLM-Summarizer: Internal tool for doc compression"],
        certifications: ["TensorFlow Developer", "Google Cloud Professional Data Engineer"],
        aiScreeningExplanation: "Elena meets the core requirements of 5 years experience and holds a highly relevant Master's in Data Science. She matches all mandatory skills including PyTorch, Transformers, NLP, and Docker. However, she lacks preferred experience in Kubernetes and Vector Databases. Highly qualified candidate suitable for preliminary phone screening."
    },
    {
        id: "cand_103",
        jobId: "job_01",
        name: "Marcus Vance",
        email: "marcus.vance@codemail.net",
        phone: "+1 (555) 234-5678",
        matchScore: 78,
        skillsMatchScore: 80,
        experienceMatchScore: 75,
        educationMatchScore: 80,
        status: "Under Review",
        skills: ["Python", "PyTorch", "NLP", "TensorFlow", "FastAPI", "Docker", "AWS", "Java"],
        matchingSkills: ["Python", "PyTorch", "NLP", "Docker", "AWS", "FastAPI"],
        missingSkills: ["Transformers", "LLMs"],
        education: "B.S. in Computer Science - University of Texas at Austin",
        experienceYears: 4,
        experienceDetails: [
            { role: "Backend / ML Engineer", company: "AeroData Corp", years: "4 years", desc: "Designed backend APIs in FastAPI and integrated TensorFlow predictive models for scheduling algorithms. Deployed containerized applications onto AWS." }
        ],
        projects: ["AeroForecast: Predictive maintenance pipeline"],
        certifications: ["AWS Certified Developer"],
        aiScreeningExplanation: "Marcus is a strong software engineer but lacks specific depth in large language models (LLMs) and modern transformers. He has 4 years of experience (slightly below the 5-year requirement) and a Bachelor's degree (preferred is Master's/Ph.D.). While his Docker/AWS skillset is solid, his NLP training has been focused on traditional models rather than generative architectures."
    },
    {
        id: "cand_104",
        jobId: "job_01",
        name: "Samuel Lin",
        email: "sam.lin@datastax.io",
        phone: "+1 (555) 456-7890",
        matchScore: 65,
        skillsMatchScore: 70,
        experienceMatchScore: 60,
        educationMatchScore: 65,
        status: "Rejected",
        skills: ["Python", "SQL", "Pandas", "Scikit-Learn", "R", "Git", "Tableau"],
        matchingSkills: ["Python"],
        missingSkills: ["PyTorch", "Transformers", "LLMs", "NLP", "Docker", "AWS"],
        education: "B.S. in Statistics - Rutgers University",
        experienceYears: 3,
        experienceDetails: [
            { role: "Data Scientist", company: "DataStax Analytics", years: "3 years", desc: "Built predictive churn models, conducted A/B testing, and designed executive dashboards using Tableau and SQL." }
        ],
        projects: ["ChurnShield: Customer attrition modeling"],
        certifications: ["Data Science Professional Certificate"],
        aiScreeningExplanation: "Samuel's background is focused on traditional statistical data science rather than Deep Learning and NLP engineering. He lacks crucial technical capabilities, specifically PyTorch, LLMs, Docker, and AWS cloud deployment. Additionally, his 3 years of experience falls short of the 5-year requirement, and his education is statistics-oriented rather than advanced computing."
    },
    {
        id: "cand_105",
        jobId: "job_01",
        name: "Priya Nair",
        email: "priya.nair@cloudnet.in",
        phone: "+1 (555) 901-2345",
        matchScore: 82,
        skillsMatchScore: 85,
        experienceMatchScore: 80,
        educationMatchScore: 80,
        status: "Under Review",
        skills: ["Python", "PyTorch", "NLP", "Transformers", "Docker", "AWS", "Git", "Flask"],
        matchingSkills: ["Python", "PyTorch", "NLP", "Transformers", "Docker", "AWS"],
        missingSkills: ["LLMs"],
        education: "M.S. in Intelligent Systems - UT Dallas",
        experienceYears: 4,
        experienceDetails: [
            { role: "AI Developer", company: "CloudNet Systems", years: "4 years", desc: "Built speech recognition scripts and text-to-speech modules. Containerized model workloads using Docker and deployed via AWS ECS." }
        ],
        projects: ["VoiceSynth: Custom TTS implementation"],
        certifications: [],
        aiScreeningExplanation: "Priya displays a solid academic foundation with an MS in Intelligent Systems. She has 4 years of experience and is proficient in PyTorch, Transformers, NLP, and containerization. Her profile lacks explicit exposure to generative LLMs, but her background suggests she could adapt rapidly. Recommended for a technical screening."
    },
    {
        id: "cand_106",
        jobId: "job_01",
        name: "Liam O'Connor",
        email: "liam.oconnor@coders.ie",
        phone: "+1 (555) 345-6789",
        matchScore: 72,
        skillsMatchScore: 75,
        experienceMatchScore: 70,
        educationMatchScore: 70,
        status: "Under Review",
        skills: ["Python", "TensorFlow", "Scikit-Learn", "Keras", "Docker", "AWS", "SQL"],
        matchingSkills: ["Python", "Docker", "AWS"],
        missingSkills: ["PyTorch", "Transformers", "LLMs", "NLP"],
        education: "B.S. in Software Engineering - Trinity College Dublin",
        experienceYears: 5,
        experienceDetails: [
            { role: "Software Engineer (ML Team)", company: "Global Logic", years: "5 years", desc: "Maintained Python backend services, orchestrated CI/CD workflows, and supported model deployments built in TensorFlow." }
        ],
        projects: ["KubeDeploy: Automated model deployment charts"],
        certifications: ["Certified Kubernetes Administrator (CKA)"],
        aiScreeningExplanation: "Liam has a strong systems engineering background, matching our Docker and AWS requirements, but his ML skills are heavily centered around traditional pipelines and TensorFlow. He does not have PyTorch or NLP/LLM experience. He represents a potential fit if the team is willing to retrain him on PyTorch and modern transformer pipelines."
    },

    // Job 02 - Lead React Developer
    {
        id: "cand_201",
        jobId: "job_02",
        name: "Sarah Jenkins",
        email: "sarah.j@frontenddev.org",
        phone: "+1 (555) 678-9012",
        matchScore: 96,
        skillsMatchScore: 98,
        experienceMatchScore: 95,
        educationMatchScore: 95,
        status: "Shortlisted",
        skills: ["React", "JavaScript", "TypeScript", "HTML5/CSS3", "Redux Toolkit", "Webpack", "Next.js", "Tailwind CSS", "Jest/Cypress", "GraphQL"],
        matchingSkills: ["React", "JavaScript", "TypeScript", "HTML5/CSS3", "Redux Toolkit", "Webpack", "Next.js", "Tailwind CSS", "Jest/Cypress"],
        missingSkills: [],
        education: "B.S. in Computer Science - Georgia Tech",
        experienceYears: 7,
        experienceDetails: [
            { role: "Lead Frontend Engineer", company: "SaaSify Inc", years: "4 years", desc: "Designed a component-driven React dashboard. Upgraded codebase to TypeScript and reduced initial page loads by 50% through code splitting and tree shaking." },
            { role: "Senior React Engineer", company: "WebFlow Agency", years: "3 years", desc: "Created pixel-perfect interfaces for consumer-facing clients. Setup automated testing pipelines using Jest and Cypress." }
        ],
        projects: ["ReactPattern: A library of customizable UX patterns", "Typescriptify: Babel compiler plugin"],
        certifications: [],
        aiScreeningExplanation: "Sarah excels in all categories. With 7 years of pure frontend experience and a Bachelor's in CS from Georgia Tech, she has operated as a Lead Frontend Engineer. She matches 100% of required and preferred skills, including React, TypeScript, Next.js, and Jest/Cypress. High alignment with our frontend performance goals."
    },
    {
        id: "cand_202",
        jobId: "job_02",
        name: "David Cho",
        email: "david.cho@uicraft.com",
        phone: "+1 (555) 890-1234",
        matchScore: 89,
        skillsMatchScore: 90,
        experienceMatchScore: 88,
        educationMatchScore: 90,
        status: "Shortlisted",
        skills: ["React", "JavaScript", "TypeScript", "HTML5/CSS3", "Redux Toolkit", "Webpack", "Next.js", "Tailwind CSS", "SASS", "Git"],
        matchingSkills: ["React", "JavaScript", "TypeScript", "HTML5/CSS3", "Redux Toolkit", "Webpack", "Next.js", "Tailwind CSS"],
        missingSkills: ["Jest/Cypress"],
        education: "B.S. in Computer Science - UC San Diego",
        experienceYears: 6,
        experienceDetails: [
            { role: "Senior Frontend Developer", company: "UICraft Software", years: "3 years", desc: "Architected micro-frontend systems using React and Webpack Module Federation. Collaborated with designers to enforce design system components." },
            { role: "Web Developer", company: "BrightMedia", years: "3 years", desc: "Built dynamic landing pages and responsive e-commerce web applications." }
        ],
        projects: ["FigmaToReact: Code generation CLI tool"],
        certifications: [],
        aiScreeningExplanation: "David possesses 6 years of experience and matches all primary core requirements, including TypeScript, Webpack, and Redux Toolkit. He exhibits strong design coordination capabilities and next-gen stack familiarity. He is missing testing experience in Jest/Cypress but remains a top candidate."
    },
    {
        id: "cand_203",
        jobId: "job_02",
        name: "Amina Yusuf",
        email: "amina.y@codebase.tech",
        phone: "+1 (555) 901-5678",
        matchScore: 76,
        skillsMatchScore: 80,
        experienceMatchScore: 70,
        educationMatchScore: 80,
        status: "Under Review",
        skills: ["React", "JavaScript", "HTML5/CSS3", "Redux", "Bootstrap", "Git", "Node.js", "Express"],
        matchingSkills: ["React", "JavaScript", "HTML5/CSS3", "Bootstrap"],
        missingSkills: ["TypeScript", "Redux Toolkit", "Webpack"],
        education: "Bachelor of Science - CUNY Queens College",
        experienceYears: 5,
        experienceDetails: [
            { role: "React Engineer", company: "Global Retail Systems", years: "3 years", desc: "Integrated backend APIs into React dashboards. Built modular web forms and managed UI alignments with Bootstrap." },
            { role: "Junior Web Developer", company: "SiteDesign Studio", years: "2 years", desc: "Drafted HTML layouts, wrote custom jQuery plugins, and maintained client WordPress instances." }
        ],
        projects: [],
        certifications: [],
        aiScreeningExplanation: "Amina has 5 years of web experience but has not yet worked as a lead developer (role requested 6 years). Her skills are solid in vanilla JS and React, but she lacks modern TypeScript experience and the build-system knowledge of Webpack/Redux Toolkit that our project demands. Suitable for mid-level frontend roles instead."
    },
    {
        id: "cand_204",
        jobId: "job_02",
        name: "Lucas Dupont",
        email: "lucas.dupont@webcode.fr",
        phone: "+33 6 12 34 56 78",
        matchScore: 58,
        skillsMatchScore: 60,
        experienceMatchScore: 55,
        educationMatchScore: 60,
        status: "Rejected",
        skills: ["JavaScript", "HTML5/CSS3", "jQuery", "Vue.js", "Bootstrap", "PHP", "Laravel"],
        matchingSkills: ["JavaScript", "HTML5/CSS3", "Bootstrap"],
        missingSkills: ["React", "TypeScript", "Redux Toolkit", "Webpack"],
        education: "B.S. in Information Technology - Université de Paris",
        experienceYears: 3,
        experienceDetails: [
            { role: "Full Stack Developer", company: "WebCode France", years: "3 years", desc: "Built MVC applications using Laravel and Vue.js. Maintained legacy jQuery structures and stylized UI layouts using Bootstrap." }
        ],
        projects: ["AutoInvoice: Invoice generator in PHP"],
        certifications: [],
        aiScreeningExplanation: "Lucas does not meet the core stack requirements for this role. The job description demands a Lead React Developer; Lucas is a junior-to-mid full-stack developer with primary expertise in Vue.js and Laravel, and virtually no professional React or TypeScript experience. His 3 years of experience also falls far short of the required 6 years."
    },

    // Job 03 - Product Designer (UI/UX)
    {
        id: "cand_301",
        jobId: "job_03",
        name: "Chloe Henderson",
        email: "chloe.h@designlab.co",
        phone: "+1 (555) 123-4567",
        matchScore: 92,
        skillsMatchScore: 95,
        experienceMatchScore: 90,
        educationMatchScore: 90,
        status: "Shortlisted",
        skills: ["Figma", "UI/UX Design", "Wireframing", "Prototyping", "Design Systems", "Usability Testing", "Adobe Illustrator", "Sketch"],
        matchingSkills: ["Figma", "UI/UX Design", "Wireframing", "Prototyping", "Design Systems", "Usability Testing"],
        missingSkills: [],
        education: "B.F.A. in Graphic Design - Rhode Island School of Design (RISD)",
        experienceYears: 5,
        experienceDetails: [
            { role: "Senior Product Designer", company: "Fintech Growth", years: "3 years", desc: "Redesigned mobile investment dashboard. Created a unified Figma Design System that cut engineering component development times by 30%." },
            { role: "UI Designer", company: "Creative Minds Agency", years: "2 years", desc: "Drafted mockups and wireframes for mobile games and custom e-commerce web brands." }
        ],
        projects: ["Systema: Open-source design library", "FinanceFlow App Mockup"],
        certifications: ["NN/g UX Certification"],
        aiScreeningExplanation: "Chloe is a highly artistic and methodical designer who studied at RISD. She has 5 years of experience (exceeding the 4-year minimum) and a robust background building unified design systems in Figma. She meets all required skills. Her portfolio contains multiple shipped B2B SaaS interfaces. Strongly recommended."
    },
    {
        id: "cand_302",
        jobId: "job_03",
        name: "Rohan Mehta",
        email: "rohan.mehta@pixelperfect.in",
        phone: "+1 (555) 456-1122",
        matchScore: 84,
        skillsMatchScore: 88,
        experienceMatchScore: 80,
        educationMatchScore: 85,
        status: "Under Review",
        skills: ["Figma", "UI/UX Design", "Wireframing", "Prototyping", "Adobe XD", "HTML/CSS", "Bootstrap"],
        matchingSkills: ["Figma", "UI/UX Design", "Wireframing", "Prototyping", "Basic HTML/CSS", "Bootstrap"],
        missingSkills: ["Design Systems"],
        education: "B.S. in Human-Computer Interaction - Indiana University",
        experienceYears: 4,
        experienceDetails: [
            { role: "UX Designer", company: "Enterprise Solutions Co", years: "4 years", desc: "Conducted usability testing sessions with enterprise clients. Created clickable prototypes and wrote basic HTML layouts for product engineers." }
        ],
        projects: ["TaskManager: Desktop tool layout design"],
        certifications: ["Google UX Design Professional Certificate"],
        aiScreeningExplanation: "Rohan fits the experience minimum (4 years) and holds an HCI degree. He has valuable hands-on skills in basic frontend engineering (HTML/CSS) which will facilitate engineering handoffs. He is slightly weak in complex enterprise Design Systems scale, but his wireframing and prototyping capabilities are highly qualified."
    },
    {
        id: "cand_303",
        jobId: "job_03",
        name: "Megan Ward",
        email: "megan.w@brandstudio.net",
        phone: "+1 (555) 678-3344",
        matchScore: 68,
        skillsMatchScore: 70,
        experienceMatchScore: 65,
        educationMatchScore: 70,
        status: "Under Review",
        skills: ["Adobe Illustrator", "Photoshop", "InDesign", "Branding", "Graphic Design", "Figma", "Social Media Art"],
        matchingSkills: ["Figma", "UI/UX Design"],
        missingSkills: ["Wireframing", "Prototyping", "Design Systems"],
        education: "B.A. in Fine Arts - Boston University",
        experienceYears: 3,
        experienceDetails: [
            { role: "Graphic Designer", company: "Brand Studio Agency", years: "3 years", desc: "Designed brand assets, logos, social media marketing decks, and printed catalog materials for retail clients." }
        ],
        projects: ["UrbanApparel Brand Assets"],
        certifications: [],
        aiScreeningExplanation: "Megan is primarily a graphic designer and brand illustrator rather than an interaction/product designer. She lacks experience in complex SaaS wireframing, high-fidelity interactive prototyping, and modern design systems. She has only 3 years of experience and lacks B2B SaaS application workflows in her portfolio."
    }
];

// Helper to initialize data in localStorage
function initializeDatabase() {
    if (!localStorage.getItem("apex_company")) {
        localStorage.setItem("apex_company", JSON.stringify(INITIAL_COMPANIES[0]));
    }
    if (!localStorage.getItem("apex_jobs")) {
        localStorage.setItem("apex_jobs", JSON.stringify(INITIAL_JOBS));
    }
    if (!localStorage.getItem("apex_candidates")) {
        localStorage.setItem("apex_candidates", JSON.stringify(INITIAL_CANDIDATES));
    }
}

// Execute initialization
initializeDatabase();

// Expose accessors that read/write from localStorage to preserve edits during the session
const db = {
    getCompany: () => {
        return JSON.parse(localStorage.getItem("apex_company"));
    },
    updateCompany: (company) => {
        localStorage.setItem("apex_company", JSON.stringify(company));
    },
    getJobs: () => {
        return JSON.parse(localStorage.getItem("apex_jobs"));
    },
    saveJobs: (jobs) => {
        localStorage.setItem("apex_jobs", JSON.stringify(jobs));
    },
    addJob: (job) => {
        const jobs = db.getJobs();
        jobs.unshift(job); // Add to beginning
        db.saveJobs(jobs);
    },
    getCandidates: () => {
        return JSON.parse(localStorage.getItem("apex_candidates"));
    },
    getCandidatesByJob: (jobId) => {
        const list = db.getCandidates().filter(c => c.jobId === jobId);
        // Return sorted by matchScore descending
        return list.sort((a, b) => b.matchScore - a.matchScore);
    },
    saveCandidates: (candidates) => {
        localStorage.setItem("apex_candidates", JSON.stringify(candidates));
    },
    addCandidatesBulk: (newCandidates) => {
        const candidates = db.getCandidates();
        const merged = [...candidates, ...newCandidates];
        db.saveCandidates(merged);
    },
    updateCandidateStatus: (candidateId, status) => {
        const candidates = db.getCandidates();
        const updated = candidates.map(c => {
            if (c.id === candidateId) {
                return { ...c, status: status };
            }
            return c;
        });
        db.saveCandidates(updated);
    },
    resetDatabase: () => {
        localStorage.setItem("apex_company", JSON.stringify(INITIAL_COMPANIES[0]));
        localStorage.setItem("apex_jobs", JSON.stringify(INITIAL_JOBS));
        localStorage.setItem("apex_candidates", JSON.stringify(INITIAL_CANDIDATES));
    }
};
