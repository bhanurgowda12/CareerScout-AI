const domains = [
  {
    id: 'software-development',
    label: 'Software and application development',
    roles: ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full-Stack Developer', 'Mobile App Developer', 'Desktop Application Developer', 'Game Developer', 'Embedded Software Engineer'],
    matchSkills: ['programming', 'python', 'javascript', 'java', 'typescript', 'html', 'css', 'react', 'node.js', 'apis', 'sql', 'testing', 'git', 'mobile development', 'c++', 'c'],
    interests: ['software', 'software development', 'web development', 'mobile apps', 'game development', 'programming', 'application development', 'embedded systems'],
    prerequisites: ['Programming fundamentals', 'Problem solving', 'Version control basics'],
    tools: ['Git', 'Code editors', 'Testing frameworks', 'Databases'],
    responsibilities: ['Design, build, test, and maintain software that solves user or business problems.', 'Collaborate with teammates to plan changes, review code, and improve reliability.'],
    workStyle: 'A mix of focused implementation, problem solving, testing, code review, and collaboration.',
    projects: ['Build a small application for a real or community need, document its design, and test its core workflows.'],
    pathways: [
      { id: 'web-interface', label: 'Web interfaces', roles: ['Frontend Developer', 'Full-Stack Developer', 'Software Engineer'], focus: 'Accessible browser interfaces and client-side application behavior.', skills: ['HTML', 'CSS', 'JavaScript', 'Accessibility', 'UI testing'], tools: ['Browser developer tools', 'Git'], prerequisites: ['Basic programming and web concepts'], exercise: 'Rebuild one responsive interface state and test keyboard navigation.', project: 'Publish an accessible, responsive site with a short usability review.' },
      { id: 'python-fastapi', label: 'Python + FastAPI', roles: ['Backend Developer', 'Full-Stack Developer', 'Software Engineer'], focus: 'Python APIs, request validation, and service integration.', skills: ['Python', 'HTTP APIs', 'FastAPI', 'SQL', 'Automated testing'], tools: ['FastAPI', 'pytest', 'Git'], prerequisites: ['Python fundamentals and basic HTTP'], exercise: 'Create and test a small validated API endpoint.', project: 'Build a documented API with persistence, input validation, and tests.' },
      { id: 'python-django', label: 'Python + Django', roles: ['Backend Developer', 'Full-Stack Developer'], focus: 'Data-backed web applications using Django.', skills: ['Python', 'Django', 'HTML templates', 'SQL', 'Testing'], tools: ['Django', 'SQLite or PostgreSQL', 'Git'], prerequisites: ['Python fundamentals and relational data basics'], exercise: 'Add a model, form, and permission-aware view to a practice app.', project: 'Create a small data-backed web application with tests and setup notes.' },
      { id: 'java-spring', label: 'Java + Spring Boot', roles: ['Backend Developer', 'Software Engineer', 'Desktop Application Developer'], focus: 'Java services, application structure, and reliable APIs.', skills: ['Java', 'Object-oriented design', 'Spring Boot', 'SQL', 'Testing'], tools: ['Spring Boot', 'Maven or Gradle', 'Git'], prerequisites: ['Java and object-oriented programming fundamentals'], exercise: 'Build a small REST endpoint with validation and a unit test.', project: 'Create a documented service with persistence and automated tests.' },
      { id: 'javascript-node', label: 'JavaScript + Node.js', roles: ['Backend Developer', 'Full-Stack Developer', 'Software Engineer'], focus: 'Server-side JavaScript and API development.', skills: ['JavaScript', 'Node.js', 'HTTP APIs', 'SQL', 'Testing'], tools: ['Node.js', 'npm', 'Git'], prerequisites: ['JavaScript fundamentals and HTTP basics'], exercise: 'Add validation and tests to a small JSON endpoint.', project: 'Build a small API-backed application with documentation.' },
      { id: 'mobile-apps', label: 'Mobile applications', roles: ['Mobile App Developer', 'Software Engineer'], focus: 'Mobile user experiences, device constraints, and application lifecycle.', skills: ['Kotlin or Swift', 'Mobile UI', 'Local persistence', 'Accessibility', 'Testing'], tools: ['Android Studio or Xcode', 'Git'], prerequisites: ['Programming fundamentals and interface basics'], exercise: 'Prototype one screen and test it on different display sizes.', project: 'Build a small mobile app with a clear user task and test notes.' },
      { id: 'games-embedded', label: 'Games and embedded systems', roles: ['Game Developer', 'Embedded Software Engineer', 'Desktop Application Developer'], focus: 'Interactive software, performance constraints, and device-aware behavior.', skills: ['C++ or C', 'Debugging', 'State management', 'Performance testing'], tools: ['A relevant game engine or device simulator', 'Git'], prerequisites: ['Programming fundamentals and basic computer architecture'], exercise: 'Build a small interaction or device simulation and measure its behavior.', project: 'Create a playable or simulated prototype with documented constraints.' },
    ],
  },
  {
    id: 'data-analytics',
    label: 'Data and analytics',
    roles: ['Data Analyst', 'Business Intelligence Analyst', 'Data Scientist', 'Data Engineer', 'Analytics Engineer', 'Database Administrator', 'Business Data Analyst'],
    matchSkills: ['sql', 'python', 'r', 'statistics', 'spreadsheets', 'excel', 'pandas', 'data visualization', 'power bi', 'tableau', 'data cleaning', 'etl', 'data modeling', 'databases'],
    interests: ['data', 'data analysis', 'analytics', 'business intelligence', 'statistics', 'research', 'reporting', 'data science'],
    prerequisites: ['Working with tables and basic data interpretation', 'Clear communication of findings'],
    tools: ['SQL', 'Spreadsheets', 'Data visualization tools'],
    responsibilities: ['Collect, prepare, analyze, or model data to answer practical questions.', 'Explain data quality, methods, and findings to people who need to make decisions.'],
    workStyle: 'A blend of investigation, data preparation, analysis, validation, and communicating results.',
    projects: ['Analyze a public dataset, document data limitations, and present a reproducible finding or dashboard.'],
    pathways: [
      { id: 'python-pandas-sql', label: 'Python + Pandas + SQL', roles: ['Data Analyst', 'Data Scientist', 'Business Data Analyst', 'Data Engineer', 'Analytics Engineer'], focus: 'Programmatic data preparation and querying relational data.', skills: ['Python', 'Pandas', 'SQL', 'Data cleaning', 'Exploratory analysis'], tools: ['Jupyter', 'Pandas', 'SQL'], prerequisites: ['Basic programming and table concepts'], exercise: 'Clean a small public dataset and answer three questions with SQL and Python.', project: 'Publish a reproducible analysis notebook with documented assumptions.' },
      { id: 'sql-powerbi', label: 'SQL + Power BI', roles: ['Data Analyst', 'Business Intelligence Analyst', 'Business Data Analyst'], focus: 'Business reporting and interactive dashboards.', skills: ['SQL', 'Data modeling', 'Power BI', 'Visual communication'], tools: ['Power BI', 'SQL'], prerequisites: ['Spreadsheets and basic relational data'], exercise: 'Create a model and dashboard from a small public dataset.', project: 'Build a dashboard with definitions, filters, and a concise decision summary.' },
      { id: 'sql-tableau', label: 'SQL + Tableau', roles: ['Data Analyst', 'Business Intelligence Analyst', 'Business Data Analyst'], focus: 'Querying and presenting data with visual analysis.', skills: ['SQL', 'Tableau', 'Chart selection', 'Data storytelling'], tools: ['Tableau Public', 'SQL'], prerequisites: ['Basic SQL and chart literacy'], exercise: 'Turn a question into a chart and annotate the result.', project: 'Publish an interactive dashboard with a short methods note.' },
      { id: 'excel-powerbi', label: 'Excel + Power BI', roles: ['Data Analyst', 'Business Intelligence Analyst', 'Business Data Analyst'], focus: 'Spreadsheet analysis and repeatable business reporting.', skills: ['Excel', 'Data cleaning', 'Power Query', 'Power BI'], tools: ['Excel', 'Power BI'], prerequisites: ['Spreadsheet formulas and basic charts'], exercise: 'Clean a workbook and build a small report from it.', project: 'Create a refreshable report with clear metric definitions.' },
      { id: 'data-pipelines', label: 'Python + SQL data pipelines', roles: ['Data Engineer', 'Analytics Engineer', 'Database Administrator'], focus: 'Reliable data movement, transformation, and storage.', skills: ['Python', 'SQL', 'Data modeling', 'Testing', 'Orchestration concepts'], tools: ['Python', 'SQL', 'Git'], prerequisites: ['Programming and relational database fundamentals'], exercise: 'Validate and transform a small dataset in repeatable steps.', project: 'Build a tested pipeline with source, transformation, and output documentation.' },
      { id: 'statistics-r', label: 'R + statistical analysis', roles: ['Data Scientist', 'Research Assistant', 'Academic Researcher'], focus: 'Statistical reasoning and reproducible analysis with R.', skills: ['R', 'Statistics', 'Data visualization', 'Research methods'], tools: ['R', 'RStudio'], prerequisites: ['Algebra and introductory statistics'], exercise: 'Reproduce a simple analysis and explain uncertainty.', project: 'Publish a reproducible report with sources and limitations.' },
    ],
  },
  {
    id: 'artificial-intelligence',
    label: 'Artificial intelligence',
    roles: ['AI Engineer', 'Machine Learning Engineer', 'NLP Engineer', 'Computer Vision Engineer', 'Generative AI Developer', 'MLOps Engineer', 'AI Research Assistant'],
    matchSkills: ['python', 'statistics', 'machine learning', 'deep learning', 'data analysis', 'linear algebra', 'pandas', 'scikit-learn', 'nlp', 'computer vision', 'generative ai', 'model evaluation', 'cloud', 'docker'],
    interests: ['artificial intelligence', 'ai', 'machine learning', 'generative ai', 'language models', 'computer vision', 'research', 'automation'],
    prerequisites: ['Programming fundamentals', 'Data handling', 'Basic probability and statistics for model-focused pathways'],
    tools: ['Python', 'Notebook environments', 'Model evaluation tools'],
    responsibilities: ['Build, evaluate, integrate, or study systems that use machine-learning methods.', 'Check model behavior, data quality, and limitations before communicating results.'],
    workStyle: 'A combination of experimentation, data work, software engineering, evaluation, and careful documentation.',
    projects: ['Compare a simple baseline with a model on a public dataset and document evaluation limits.'],
    pathways: [
      { id: 'ml-foundations', label: 'Machine learning engineering', roles: ['Machine Learning Engineer', 'AI Engineer', 'AI Research Assistant'], focus: 'Model foundations, evaluation, and reproducible experiments.', skills: ['Python', 'Pandas', 'Statistics', 'Scikit-learn', 'Model evaluation'], tools: ['Python', 'Scikit-learn', 'Jupyter'], prerequisites: ['Python, data handling, and introductory statistics'], exercise: 'Train a baseline model and inspect precision, recall, and errors.', project: 'Publish a reproducible model comparison with limitations and a baseline.' },
      { id: 'nlp', label: 'Natural language processing', roles: ['NLP Engineer', 'Generative AI Developer', 'AI Engineer'], focus: 'Text processing, language model use, and evaluation.', skills: ['Python', 'Text processing', 'NLP evaluation', 'Prompt and output validation'], tools: ['Python', 'Relevant NLP libraries'], prerequisites: ['Python and basic data preparation'], exercise: 'Compare a simple text baseline with a model on a small public dataset.', project: 'Build a text application with evaluation examples and failure cases.' },
      { id: 'computer-vision', label: 'Computer vision', roles: ['Computer Vision Engineer', 'Machine Learning Engineer', 'AI Research Assistant'], focus: 'Image data, vision models, and error analysis.', skills: ['Python', 'Image data', 'Model evaluation', 'Computer vision fundamentals'], tools: ['Python', 'OpenCV or a model framework'], prerequisites: ['Python and introductory machine learning'], exercise: 'Inspect image data and evaluate a small classifier on held-out examples.', project: 'Document a vision prototype, its evaluation, and data limitations.' },
      { id: 'generative-ai-apps', label: 'Generative AI applications', roles: ['Generative AI Developer', 'AI Engineer'], focus: 'Reliable applications that integrate generative models.', skills: ['API integration', 'Prompt design', 'Output validation', 'Evaluation', 'Privacy basics'], tools: ['Model APIs', 'Python or JavaScript', 'Automated tests'], prerequisites: ['Programming and API fundamentals'], exercise: 'Add structured output checks and a small evaluation set to a prototype.', project: 'Build an AI-assisted workflow with clear scope, validation, and limitations.' },
      { id: 'mlops', label: 'MLOps and production systems', roles: ['MLOps Engineer', 'Machine Learning Engineer', 'AI Engineer'], focus: 'Testing, packaging, deployment, and monitoring for model systems.', skills: ['Python', 'Git', 'Containers', 'CI/CD', 'Monitoring', 'Model lifecycle'], tools: ['Git', 'Docker', 'CI tools'], prerequisites: ['Programming, software testing, and basic deployment'], exercise: 'Package a small model service and add a repeatable test step.', project: 'Create a reproducible model delivery pipeline with a monitoring plan.' },
    ],
  },
  {
    id: 'cybersecurity',
    label: 'Cybersecurity',
    roles: ['Cybersecurity Analyst', 'SOC Analyst', 'Security Engineer', 'Ethical Hacker', 'Penetration Tester', 'Digital Forensics Analyst', 'Incident Response Analyst', 'Cloud Security Engineer', 'Identity and Access Management Specialist', 'Governance, Risk and Compliance Analyst'],
    matchSkills: ['networking', 'linux', 'windows', 'security', 'python', 'logs', 'siem', 'incident response', 'cloud', 'identity', 'iam', 'risk', 'compliance', 'forensics', 'wireshark'],
    interests: ['cybersecurity', 'security', 'defensive security', 'ethical hacking', 'penetration testing', 'digital forensics', 'incident response', 'privacy', 'risk management'],
    prerequisites: ['Networking and operating-system fundamentals', 'Ethical and legal boundaries for all security practice'],
    tools: ['Linux', 'Network analysis tools', 'Logs and monitoring platforms'],
    responsibilities: ['Reduce security risk by monitoring, assessing, designing, or responding to issues.', 'Document evidence and follow approved authorization, privacy, and change-control boundaries.'],
    workStyle: 'Careful investigation, defensive analysis, clear reporting, and controlled practice in explicitly authorized systems.',
    projects: ['Analyze supplied sample logs or a deliberately vulnerable training lab and write a defensive findings report.'],
    pathways: [
      { id: 'soc-defensive', label: 'SOC and defensive security', roles: ['Cybersecurity Analyst', 'SOC Analyst', 'Incident Response Analyst'], focus: 'Alert triage, log analysis, and incident response in defensive environments.', skills: ['Networking', 'Operating systems', 'Logs', 'SIEM concepts', 'Incident documentation'], tools: ['Wireshark', 'A SIEM training environment', 'Linux'], prerequisites: ['Networking and operating-system basics'], exercise: 'Analyze provided sample logs in a training environment and document a benign-versus-suspicious hypothesis.', project: 'Create a defensive incident timeline using synthetic or lab-provided logs.' },
      { id: 'authorized-labs', label: 'Authorized penetration-testing labs', roles: ['Ethical Hacker', 'Penetration Tester', 'Security Engineer'], focus: 'Understand common weaknesses and validate defenses only in explicitly authorized labs.', skills: ['Networking', 'Linux', 'Web fundamentals', 'Vulnerability reporting', 'Ethics'], tools: ['TryHackMe controlled labs', 'Browser developer tools'], prerequisites: ['Networking, Linux, and written authorization for every target'], exercise: 'Complete a sandboxed beginner lab and write remediation steps; do not test public systems.', project: 'Submit a lab-only assessment report with scope, evidence, impact, and remediation.' },
      { id: 'cloud-security', label: 'Cloud security', roles: ['Cloud Security Engineer', 'Security Engineer', 'Cloud Engineer'], focus: 'Identity, configuration, network boundaries, and monitoring in cloud environments.', skills: ['Cloud fundamentals', 'IAM', 'Networking', 'Logging', 'Threat modeling'], tools: ['Cloud provider learning sandboxes', 'Policy and logging tools'], prerequisites: ['Networking, identity concepts, and cloud basics'], exercise: 'Review a provided sample cloud configuration and propose least-privilege changes.', project: 'Build a sandbox-only secure reference design and threat model.' },
      { id: 'identity-grc', label: 'Identity and governance, risk, and compliance', roles: ['Identity and Access Management Specialist', 'Governance, Risk and Compliance Analyst', 'Cybersecurity Analyst'], focus: 'Access governance, control evidence, and practical risk communication.', skills: ['Identity concepts', 'Access reviews', 'Risk assessment', 'Policy writing', 'Audit evidence'], tools: ['Identity platform documentation', 'Control registers'], prerequisites: ['Basic security and organizational process concepts'], exercise: 'Review a fictional access matrix and record least-privilege findings.', project: 'Create a sample access review and risk register using fictional data.' },
      { id: 'forensics', label: 'Digital forensics', roles: ['Digital Forensics Analyst', 'Incident Response Analyst'], focus: 'Evidence handling, timelines, and repeatable examination in controlled cases.', skills: ['Operating systems', 'File systems', 'Evidence handling', 'Timeline analysis', 'Reporting'], tools: ['Forensic training images', 'Hashing tools'], prerequisites: ['Operating-system basics and evidence integrity concepts'], exercise: 'Examine a provided training image and document a reproducible timeline.', project: 'Write a lab-case report with evidence hashes and stated limitations.' },
    ],
  },
  {
    id: 'cloud-infrastructure',
    label: 'Cloud, DevOps and infrastructure',
    roles: ['Cloud Engineer', 'Cloud Architect', 'DevOps Engineer', 'Site Reliability Engineer', 'Platform Engineer', 'Infrastructure Engineer', 'System Administrator', 'Network Engineer', 'IT Support Specialist'],
    matchSkills: ['linux', 'networking', 'cloud', 'aws', 'azure', 'google cloud', 'python', 'bash', 'powershell', 'docker', 'kubernetes', 'ci/cd', 'terraform', 'monitoring', 'troubleshooting'],
    interests: ['cloud computing', 'cloud', 'devops', 'infrastructure', 'networking', 'reliability', 'systems administration', 'it support', 'automation'],
    prerequisites: ['Networking fundamentals', 'Operating-system basics', 'Command-line familiarity for infrastructure-heavy pathways'],
    tools: ['Linux', 'Git', 'Cloud learning sandboxes', 'Monitoring tools'],
    responsibilities: ['Build, operate, automate, or support computing platforms and networks.', 'Balance service availability, security, operational clarity, and change management.'],
    workStyle: 'A mix of configuration, automation, troubleshooting, documentation, and operational collaboration.',
    projects: ['Deploy a small service in a sandbox, document its architecture, and describe its monitoring and recovery plan.'],
    pathways: [
      { id: 'cloud-foundations', label: 'Cloud infrastructure', focus: 'Cloud fundamentals, networking, identity, and controlled deployments.', skills: ['Linux', 'Networking', 'Cloud fundamentals', 'IAM', 'Monitoring'], tools: ['Cloud provider learning sandbox', 'CLI'], prerequisites: ['Networking and operating-system basics'], exercise: 'Deploy a small sample service in a free or training sandbox and document resources.', project: 'Create a sandbox architecture with access, cost awareness, and recovery notes.' },
      { id: 'devops-cicd', label: 'CI/CD and automation', roles: ['DevOps Engineer', 'Platform Engineer', 'Infrastructure Engineer'], focus: 'Automated build, test, and release workflows.', skills: ['Git', 'Scripting', 'CI/CD', 'Containers', 'Secrets handling'], tools: ['GitHub Actions or another CI system', 'Docker'], prerequisites: ['Command line, Git, and basic application delivery'], exercise: 'Build a pipeline that runs tests on a sample project.', project: 'Automate a test-and-deploy workflow for a safe demo service.' },
      { id: 'infrastructure-code', label: 'Infrastructure as code', roles: ['Cloud Engineer', 'Cloud Architect', 'DevOps Engineer', 'Platform Engineer', 'Infrastructure Engineer'], focus: 'Repeatable infrastructure changes with reviewable configuration.', skills: ['Networking', 'Cloud identity', 'Infrastructure as code', 'Testing', 'Change review'], tools: ['Terraform or a cloud-native template language'], prerequisites: ['Cloud and network basics'], exercise: 'Provision and remove a small sandbox resource set from a reviewed template.', project: 'Publish an environment template with validation and teardown instructions.' },
      { id: 'sre-monitoring', label: 'Reliability engineering', roles: ['Site Reliability Engineer', 'Platform Engineer', 'Cloud Engineer'], focus: 'Service health, observability, incident learning, and safe operational changes.', skills: ['Linux', 'Networking', 'Monitoring', 'Incident response', 'Automation'], tools: ['Logs, metrics, tracing, and alerting tools'], prerequisites: ['Operating systems, networks, and service operations'], exercise: 'Instrument a demo service and analyze a simulated outage.', project: 'Create a service-level dashboard and a blameless incident review for a demo.' },
      { id: 'network-systems', label: 'Networking and systems administration', roles: ['Network Engineer', 'System Administrator', 'IT Support Specialist', 'Infrastructure Engineer'], focus: 'Network operations, endpoint support, and dependable systems.', skills: ['TCP/IP', 'DNS', 'Linux or Windows administration', 'Troubleshooting', 'Documentation'], tools: ['Network simulators', 'Operating-system tools'], prerequisites: ['Computer and network fundamentals'], exercise: 'Diagnose a simulated connectivity problem using a written checklist.', project: 'Document a small lab network with a support and recovery runbook.' },
    ],
  },
  {
    id: 'software-quality',
    label: 'Software quality and testing',
    roles: ['QA Engineer', 'Software Test Engineer', 'Automation Test Engineer', 'Performance Test Engineer', 'Quality Assurance Analyst'],
    matchSkills: ['testing', 'automation', 'python', 'javascript', 'java', 'quality assurance', 'test cases', 'api testing', 'performance testing', 'sql', 'debugging'],
    interests: ['quality assurance', 'software testing', 'test automation', 'reliability', 'debugging', 'quality'],
    prerequisites: ['Structured problem solving', 'Basic software or product workflows'],
    tools: ['Test management tools', 'Browser developer tools', 'Automation frameworks'],
    responsibilities: ['Design and execute checks that help teams discover defects and reduce release risk.', 'Communicate reproducible evidence, quality trends, and areas that need further testing.'],
    workStyle: 'Careful exploratory work, repeatable test design, defect communication, and collaboration with product teams.',
    projects: ['Create a test plan for a small application and automate a few stable, high-value checks.'],
    pathways: [
      { id: 'qa-foundations', label: 'Quality assurance foundations', focus: 'Risk-based test cases, exploratory testing, and clear defect reports.', skills: ['Test design', 'Exploratory testing', 'Bug reporting', 'SQL basics'], tools: ['Browser tools', 'Issue tracker'], prerequisites: ['Comfort using software and describing expected behavior'], exercise: 'Test a small demo workflow and file reproducible fictional defects.', project: 'Publish a test plan, coverage notes, and risk-focused test report.' },
      { id: 'test-automation', label: 'Test automation', roles: ['Automation Test Engineer', 'QA Engineer', 'Software Test Engineer'], focus: 'Stable automated checks for APIs and user workflows.', skills: ['Programming', 'API testing', 'Automation frameworks', 'CI basics'], tools: ['Playwright, Selenium, or API test tools'], prerequisites: ['Programming basics and test design'], exercise: 'Automate a repeatable happy path and one validation case.', project: 'Add an automated suite and CI run to a sample application.' },
      { id: 'performance-quality', label: 'Performance testing', roles: ['Performance Test Engineer', 'QA Engineer'], focus: 'Measure system behavior under controlled workloads.', skills: ['HTTP', 'Metrics', 'Load testing', 'Data interpretation'], tools: ['A local demo service', 'Load-test tools'], prerequisites: ['HTTP and basic metrics'], exercise: 'Run a small local load test and interpret response-time changes.', project: 'Create a safe, local performance report with baseline and caveats.' },
    ],
  },
  {
    id: 'design-product',
    label: 'UI/UX and product design',
    roles: ['UI Designer', 'UX Designer', 'UX Researcher', 'Product Designer', 'Interaction Designer', 'Accessibility Specialist', 'Product Manager', 'Technical Writer'],
    matchSkills: ['design', 'figma', 'prototyping', 'user research', 'accessibility', 'wireframing', 'visual design', 'usability testing', 'product management', 'writing', 'content design'],
    interests: ['design', 'ui', 'ux', 'user experience', 'accessibility', 'product design', 'research', 'interaction design', 'technical writing'],
    prerequisites: ['Curiosity about user needs', 'Clear communication and willingness to test assumptions'],
    tools: ['Figma or equivalent design tools', 'Interview and usability methods'],
    responsibilities: ['Understand user needs and shape product direction, interaction, visual systems, or documentation.', 'Use research and testing to communicate design decisions and improve usability.'],
    workStyle: 'Research, sketching, prototyping, critique, writing, and collaboration with product and engineering teams.',
    projects: ['Choose a real task, study its users ethically, prototype an improvement, and document what testing changed.'],
    pathways: [
      { id: 'ux-research', label: 'UX research', roles: ['UX Researcher', 'UX Designer', 'Product Designer'], focus: 'Research questions, ethical participant studies, synthesis, and evidence.', skills: ['Research planning', 'Interviewing', 'Synthesis', 'Usability testing', 'Communication'], tools: ['Interview guides', 'Research repositories'], prerequisites: ['Curiosity and clear note-taking'], exercise: 'Run a small, consent-based usability test on a public or personal prototype.', project: 'Publish an anonymized research summary with methods and limitations.' },
      { id: 'ui-interaction', label: 'UI and interaction design', roles: ['UI Designer', 'Interaction Designer', 'Product Designer'], focus: 'Visual hierarchy, interaction patterns, responsive layouts, and prototyping.', skills: ['Visual design', 'Interaction design', 'Prototyping', 'Design systems'], tools: ['Figma', 'FigJam'], prerequisites: ['Visual observation and basic interface familiarity'], exercise: 'Prototype a key flow and test it at mobile and desktop sizes.', project: 'Build an annotated interactive prototype with states and rationale.' },
      { id: 'accessibility', label: 'Accessibility and inclusive design', roles: ['Accessibility Specialist', 'UX Designer', 'UI Designer'], focus: 'Inclusive interaction, semantics, assistive technology, and accessibility checks.', skills: ['WCAG concepts', 'Keyboard interaction', 'Semantic UI', 'Accessible research'], tools: ['Screen readers', 'Accessibility checkers', 'Browser tools'], prerequisites: ['Basic interface and web concepts'], exercise: 'Audit a small interface with keyboard-only interaction and document barriers.', project: 'Improve a prototype and publish an accessibility rationale and test notes.' },
      { id: 'product-management', label: 'Product management', roles: ['Product Manager', 'Product Designer'], focus: 'User problems, prioritization, delivery, and outcome measurement.', skills: ['Problem framing', 'Prioritization', 'Roadmapping', 'Communication', 'Analytics'], tools: ['Product briefs', 'Planning boards'], prerequisites: ['Clear writing and basic project collaboration'], exercise: 'Write a one-page brief distinguishing user problem, evidence, and solution.', project: 'Create a small product proposal with assumptions and success measures.' },
      { id: 'technical-communication', label: 'Technical communication', roles: ['Technical Writer', 'Product Manager'], focus: 'Clear, task-centered instructions and information architecture.', skills: ['Writing', 'Audience analysis', 'Information architecture', 'Review'], tools: ['Markdown', 'Documentation tools'], prerequisites: ['Clear writing and willingness to test instructions'], exercise: 'Rewrite a setup guide and have a peer follow it without extra help.', project: 'Publish a task-based guide with examples and a review checklist.' },
    ],
  },
  {
    id: 'business-operations',
    label: 'Business and operations',
    roles: ['Business Analyst', 'Project Manager', 'Operations Analyst', 'Process Improvement Analyst', 'Business Operations Specialist', 'HR Analyst', 'Customer Success Specialist'],
    matchSkills: ['business analysis', 'process mapping', 'excel', 'spreadsheets', 'project management', 'communication', 'requirements', 'reporting', 'data analysis', 'human resources', 'customer success'],
    interests: ['business', 'operations', 'project management', 'process improvement', 'human resources', 'customer experience', 'strategy'],
    prerequisites: ['Clear communication', 'Structured problem solving', 'Basic spreadsheet familiarity for analytics pathways'],
    tools: ['Spreadsheets', 'Process maps', 'Project planning tools'],
    responsibilities: ['Understand a business or operational need, coordinate work, and improve how a service runs.', 'Translate evidence and stakeholder needs into documented options and next steps.'],
    workStyle: 'Stakeholder conversations, analysis, planning, documentation, and practical follow-through.',
    projects: ['Map a fictional or volunteer process, identify a measurable friction point, and propose a low-risk improvement.'],
    pathways: [
      { id: 'business-analysis', label: 'Business analysis', roles: ['Business Analyst', 'Business Operations Specialist'], focus: 'Requirements, process understanding, and decision support.', skills: ['Requirements gathering', 'Process mapping', 'Excel', 'Communication'], tools: ['Spreadsheets', 'Diagramming tools'], prerequisites: ['Clear writing and stakeholder listening'], exercise: 'Convert a short fictional stakeholder request into testable requirements.', project: 'Create a process map, requirements brief, and acceptance criteria.' },
      { id: 'operations-analytics', label: 'Operations analytics', roles: ['Operations Analyst', 'Process Improvement Analyst', 'Business Operations Specialist'], focus: 'Operational metrics, bottlenecks, and measurable improvement.', skills: ['Spreadsheets', 'Data interpretation', 'Process mapping', 'Measurement'], tools: ['Excel or Google Sheets', 'Dashboard tools'], prerequisites: ['Spreadsheet and basic metric concepts'], exercise: 'Analyze a fictional process dataset and state its limitations.', project: 'Present an evidence-based process improvement proposal.' },
      { id: 'project-delivery', label: 'Project management', roles: ['Project Manager', 'Business Analyst'], focus: 'Scope, sequencing, risks, communication, and delivery.', skills: ['Planning', 'Risk tracking', 'Facilitation', 'Status communication'], tools: ['Project boards', 'Planning documents'], prerequisites: ['Organization and collaborative communication'], exercise: 'Break a small project into milestones and identify delivery risks.', project: 'Create a lightweight project plan and retrospective for a portfolio project.' },
      { id: 'people-customer-ops', label: 'People and customer operations', roles: ['HR Analyst', 'Customer Success Specialist'], focus: 'Responsible service operations, feedback, and human-centered processes.', skills: ['Communication', 'Data privacy', 'Service workflows', 'Reporting'], tools: ['Spreadsheets', 'Knowledge-base tools'], prerequisites: ['Communication and respectful data handling'], exercise: 'Map a fictional support journey without using real personal data.', project: 'Design a service improvement with an anonymized metric plan.' },
    ],
  },
  {
    id: 'finance-accounting',
    label: 'Finance and accounting',
    roles: ['Financial Analyst', 'Accountant', 'Risk Analyst', 'Financial Data Analyst', 'FinTech Analyst', 'Audit Associate'],
    matchSkills: ['accounting', 'finance', 'excel', 'spreadsheets', 'financial analysis', 'statistics', 'sql', 'risk analysis', 'reporting', 'audit', 'data analysis'],
    interests: ['finance', 'accounting', 'financial analysis', 'fintech', 'risk', 'audit', 'markets', 'budgeting'],
    prerequisites: ['Numeracy and careful record keeping', 'Spreadsheet fundamentals'],
    tools: ['Spreadsheets', 'Accounting and reporting systems', 'SQL for data-oriented roles'],
    responsibilities: ['Prepare, analyze, or review financial information for planning, reporting, controls, or risk decisions.', 'Document assumptions, reconcile data, and follow applicable professional and regulatory processes.'],
    workStyle: 'Structured analysis, careful review, spreadsheet or reporting work, and communication of assumptions.',
    projects: ['Use clearly labeled sample data to create a financial summary and explain assumptions, exclusions, and limitations.'],
    pathways: [
      { id: 'financial-analysis', label: 'Financial analysis and reporting', roles: ['Financial Analyst', 'Financial Data Analyst', 'FinTech Analyst'], focus: 'Structured financial models, business metrics, and clear reporting.', skills: ['Accounting fundamentals', 'Excel', 'Financial statements', 'Data interpretation'], tools: ['Excel or Google Sheets'], prerequisites: ['Basic numeracy and spreadsheet formulas'], exercise: 'Analyze a fictional company dataset with transparent assumptions.', project: 'Build a sample financial analysis workbook with an executive summary.' },
      { id: 'accounting-audit', label: 'Accounting and audit', roles: ['Accountant', 'Audit Associate'], focus: 'Accurate records, reconciliations, controls, and evidence.', skills: ['Accounting principles', 'Reconciliation', 'Internal controls', 'Documentation'], tools: ['Spreadsheets', 'Accounting software training material'], prerequisites: ['Basic accounting concepts and attention to detail'], exercise: 'Reconcile fictional sample records and document exceptions.', project: 'Create a mock close checklist and evidence trail using synthetic data.' },
      { id: 'risk-finance-data', label: 'Risk and financial data', roles: ['Risk Analyst', 'Financial Data Analyst', 'FinTech Analyst'], focus: 'Risk indicators, data quality, and explainable reporting.', skills: ['Statistics', 'Excel', 'SQL', 'Risk concepts', 'Data validation'], tools: ['Spreadsheets', 'SQL'], prerequisites: ['Basic statistics and spreadsheet skills'], exercise: 'Review a synthetic risk dataset for missingness and misleading aggregates.', project: 'Publish a risk-monitoring report with caveats and validation checks.' },
    ],
  },
  {
    id: 'marketing-communications',
    label: 'Marketing, sales and communications',
    roles: ['Digital Marketing Specialist', 'SEO Specialist', 'Content Strategist', 'Marketing Analyst', 'Social Media Specialist', 'Sales Operations Analyst', 'Market Research Analyst'],
    matchSkills: ['marketing', 'seo', 'content strategy', 'writing', 'analytics', 'spreadsheets', 'social media', 'campaigns', 'market research', 'communication', 'sales operations'],
    interests: ['marketing', 'digital marketing', 'content', 'seo', 'social media', 'communications', 'market research', 'sales'],
    prerequisites: ['Audience awareness', 'Clear communication', 'Basic measurement literacy'],
    tools: ['Spreadsheets', 'Analytics platforms', 'Content planning tools'],
    responsibilities: ['Understand audiences and plan, measure, or communicate products and services responsibly.', 'Use evidence to refine content, channels, campaigns, or customer acquisition processes.'],
    workStyle: 'Research, writing, coordination, campaign operations, and analysis of audience response.',
    projects: ['Develop a small, clearly labeled sample campaign plan with an audience hypothesis and measurement plan.'],
    pathways: [
      { id: 'digital-marketing', label: 'Digital marketing and analytics', roles: ['Digital Marketing Specialist', 'Marketing Analyst', 'Sales Operations Analyst'], focus: 'Channel planning, measurement, and responsible campaign improvement.', skills: ['Audience research', 'Campaign planning', 'Analytics', 'Spreadsheets', 'Conversion measurement'], tools: ['Spreadsheets', 'Analytics training accounts'], prerequisites: ['Basic spreadsheet and communication skills'], exercise: 'Interpret a sample campaign report without claiming causation from correlation.', project: 'Create a small campaign brief with metrics, privacy notes, and a review plan.' },
      { id: 'seo-content', label: 'SEO and content strategy', roles: ['SEO Specialist', 'Content Strategist'], focus: 'Useful content planning, search intent, and discoverability.', skills: ['Audience research', 'Content writing', 'Search fundamentals', 'Editorial planning'], tools: ['Search documentation', 'Editorial calendar'], prerequisites: ['Clear writing and web literacy'], exercise: 'Improve the structure of a sample article for a stated reader need.', project: 'Create a content brief and measurement plan for a non-commercial sample topic.' },
      { id: 'social-research', label: 'Social media and market research', roles: ['Social Media Specialist', 'Market Research Analyst'], focus: 'Audience listening, ethical research, and channel communication.', skills: ['Research methods', 'Writing', 'Survey basics', 'Reporting'], tools: ['Spreadsheets', 'Content planning tools'], prerequisites: ['Communication and ethical data handling'], exercise: 'Synthesize a fictional set of feedback into themes without exposing individuals.', project: 'Publish an audience insight brief using synthetic or public aggregate data.' },
    ],
  },
  {
    id: 'education-research',
    label: 'Education and research',
    roles: ['Technical Trainer', 'Research Assistant', 'Educational Technology Specialist', 'Academic Researcher', 'Learning Experience Designer'],
    matchSkills: ['teaching', 'research', 'writing', 'communication', 'data analysis', 'curriculum design', 'learning design', 'education technology', 'facilitation'],
    interests: ['education', 'teaching', 'research', 'learning', 'training', 'academic research', 'instructional design'],
    prerequisites: ['Clear communication', 'Ethical handling of learner or research data'],
    tools: ['Learning platforms', 'Research methods', 'Documentation tools'],
    responsibilities: ['Support learning, training, or research through structured materials and careful evidence gathering.', 'Communicate methods, findings, and limitations to learners or research teams.'],
    workStyle: 'Planning, explanation, facilitation, evaluation, writing, and collaborative inquiry.',
    projects: ['Create a short learning activity or research brief, test it with consent, and revise using feedback.'],
    pathways: [
      { id: 'technical-training', label: 'Technical training', roles: ['Technical Trainer', 'Educational Technology Specialist'], focus: 'Clear technical instruction and practical learner exercises.', skills: ['Subject communication', 'Lesson planning', 'Demonstration', 'Assessment'], tools: ['Documentation', 'Learning platforms'], prerequisites: ['A topic to teach and audience awareness'], exercise: 'Write and test a short lesson with one hands-on activity.', project: 'Publish a beginner lesson with learning objectives and feedback notes.' },
      { id: 'learning-experience', label: 'Learning experience design', roles: ['Learning Experience Designer', 'Educational Technology Specialist'], focus: 'Learning objectives, learner needs, accessible materials, and evaluation.', skills: ['Learning design', 'Accessibility', 'Content structure', 'Evaluation'], tools: ['Authoring tools', 'Learning platforms'], prerequisites: ['Communication and basic instructional planning'], exercise: 'Turn one learning objective into an accessible practice activity.', project: 'Prototype a short module with outcomes and a feedback plan.' },
      { id: 'research-methods', label: 'Research and evidence', roles: ['Research Assistant', 'Academic Researcher'], focus: 'Research questions, sources, methods, data integrity, and reproducible reporting.', skills: ['Research methods', 'Literature review', 'Data handling', 'Writing'], tools: ['Reference manager', 'Spreadsheets or statistical tools'], prerequisites: ['Ethical research awareness and careful note-taking'], exercise: 'Summarize a small set of public sources with evidence and limitations.', project: 'Create a reproducible mini-study using public or synthetic data.' },
    ],
  },
  {
    id: 'engineering-manufacturing',
    label: 'Engineering and manufacturing',
    roles: ['Manufacturing Engineer', 'Mechanical Engineer', 'Electrical Engineer', 'Industrial Engineer', 'Quality Engineer'],
    matchSkills: ['engineering', 'manufacturing', 'mechanical design', 'electrical systems', 'cad', 'quality', 'process improvement', 'simulation', 'safety'],
    interests: ['engineering', 'manufacturing', 'mechanical systems', 'electrical systems', 'industrial design', 'process improvement'],
    prerequisites: ['Relevant foundational math and science', 'Safety awareness and respect for controlled equipment'],
    tools: ['CAD or simulation tools', 'Measurement and quality documentation'],
    responsibilities: ['Design, analyze, improve, or validate physical systems and production processes.', 'Apply safety, quality, and traceability practices appropriate to the work.'],
    workStyle: 'Analysis, design iteration, measurement, technical documentation, and cross-functional work.',
    projects: ['Model or simulate a small non-hazardous system and document design assumptions and safety boundaries.'],
    pathways: [
      { id: 'engineering-design', label: 'Engineering design and simulation', focus: 'Requirements, modeling, simulation, and design trade-offs.', skills: ['Engineering fundamentals', 'CAD or simulation', 'Measurement', 'Technical writing'], tools: ['CAD or open simulation tools'], prerequisites: ['Relevant math, science, and safety basics'], exercise: 'Model a simple non-hazardous component and compare two design assumptions.', project: 'Create a design brief with drawings, assumptions, and validation plan.' },
      { id: 'manufacturing-quality', label: 'Manufacturing and process quality', focus: 'Process mapping, quality measures, and continuous improvement.', skills: ['Process analysis', 'Quality methods', 'Measurement', 'Documentation'], tools: ['Spreadsheets', 'Process maps'], prerequisites: ['Basic engineering and safety concepts'], exercise: 'Analyze a fictional process and identify a measurable source of variation.', project: 'Propose a safe process improvement with baseline and follow-up measures.' },
    ],
  },
  {
    id: 'healthcare-life-sciences',
    label: 'Healthcare and life sciences',
    roles: ['Healthcare Data Analyst', 'Clinical Research Assistant', 'Bioinformatics Analyst', 'Health Informatics Specialist'],
    matchSkills: ['healthcare', 'biology', 'life sciences', 'statistics', 'data analysis', 'python', 'research', 'privacy', 'bioinformatics'],
    interests: ['healthcare', 'health', 'biology', 'life sciences', 'medicine', 'clinical research', 'public health'],
    prerequisites: ['Domain-specific study as required by the role', 'Privacy, consent, and research ethics'],
    tools: ['Spreadsheets or statistical tools', 'De-identified or synthetic datasets'],
    responsibilities: ['Support health-related analysis, research, or information systems under applicable privacy and professional rules.', 'Use approved, de-identified, or synthetic data and report methods and limitations.'],
    workStyle: 'Careful data handling, domain collaboration, documentation, and evidence-based reporting.',
    projects: ['Analyze a public or synthetic health dataset and clearly explain privacy safeguards and limitations.'],
    pathways: [
      { id: 'health-data', label: 'Health data and informatics', focus: 'Responsible analysis and information workflows using de-identified data.', skills: ['Statistics', 'Data cleaning', 'SQL or spreadsheets', 'Privacy principles', 'Reporting'], tools: ['Spreadsheets', 'SQL', 'Statistical tools'], prerequisites: ['Basic data analysis and privacy awareness'], exercise: 'Analyze synthetic records and check for missing or inconsistent values.', project: 'Publish an aggregate-only report with a privacy and limitations note.' },
      { id: 'life-science-research', label: 'Life-science research support', focus: 'Reproducible research workflows and biological data interpretation.', skills: ['Research methods', 'Data handling', 'Statistics', 'Scientific writing'], tools: ['R or Python where relevant', 'Reference manager'], prerequisites: ['Relevant life-science foundations and research ethics'], exercise: 'Reproduce a small result from a public teaching dataset.', project: 'Create a methods-focused research brief with reproducibility notes.' },
    ],
  },
  {
    id: 'agriculture-environment',
    label: 'Agriculture and environmental science',
    roles: ['Agricultural Data Analyst', 'Environmental Scientist', 'Climate Data Analyst', 'Conservation Project Assistant'],
    matchSkills: ['agriculture', 'environmental science', 'climate', 'gis', 'statistics', 'data analysis', 'biology', 'field research', 'sustainability'],
    interests: ['agriculture', 'environment', 'climate', 'conservation', 'sustainability', 'ecology', 'food systems'],
    prerequisites: ['Relevant science foundations', 'Field safety and ethical data collection'],
    tools: ['Spreadsheets', 'GIS or public environmental datasets'],
    responsibilities: ['Collect or interpret environmental and agricultural evidence for research, planning, or conservation.', 'Describe uncertainty, geographic limits, and data-collection methods.'],
    workStyle: 'A mix of research, data interpretation, field or stakeholder work, and reporting.',
    projects: ['Map or summarize a public environmental dataset and explain its geographic and measurement limits.'],
    pathways: [
      { id: 'environment-data', label: 'Environmental and climate data', focus: 'Data quality, geographic context, visualization, and careful interpretation.', skills: ['Statistics', 'Data cleaning', 'GIS concepts', 'Visualization', 'Scientific communication'], tools: ['QGIS or public map tools', 'Spreadsheets'], prerequisites: ['Basic statistics and environmental context'], exercise: 'Visualize public data with clear units and boundaries.', project: 'Create a map-based report with sources and uncertainty notes.' },
      { id: 'agriculture-systems', label: 'Agriculture and food systems', focus: 'Agricultural processes, sustainability evidence, and practical measurement.', skills: ['Agriculture fundamentals', 'Data collection', 'Process analysis', 'Communication'], tools: ['Spreadsheets', 'Field or public data tools'], prerequisites: ['Relevant agricultural or biological basics'], exercise: 'Compare a small set of public agricultural indicators.', project: 'Prepare a documented improvement idea with data and safety considerations.' },
    ],
  },
  {
    id: 'logistics-supply-chain',
    label: 'Logistics and supply chain',
    roles: ['Supply Chain Analyst', 'Logistics Analyst', 'Procurement Analyst', 'Inventory Planner'],
    matchSkills: ['supply chain', 'logistics', 'operations', 'excel', 'spreadsheets', 'forecasting', 'data analysis', 'inventory', 'procurement', 'sql'],
    interests: ['logistics', 'supply chain', 'operations', 'procurement', 'inventory', 'planning'],
    prerequisites: ['Spreadsheet fundamentals', 'Process and measurement basics'],
    tools: ['Spreadsheets', 'Reporting tools', 'Process maps'],
    responsibilities: ['Analyze or coordinate the movement, availability, and planning of goods and services.', 'Identify process constraints and communicate practical options using evidence.'],
    workStyle: 'Data review, coordination, planning, supplier or operations communication, and process improvement.',
    projects: ['Analyze a synthetic inventory dataset and document a cautious replenishment recommendation.'],
    pathways: [
      { id: 'supply-chain-analysis', label: 'Supply chain analytics', focus: 'Inventory, service levels, and operational measurement.', skills: ['Excel', 'Data cleaning', 'Forecasting basics', 'KPI definitions'], tools: ['Spreadsheets', 'BI tools'], prerequisites: ['Spreadsheet formulas and basic statistics'], exercise: 'Analyze a synthetic demand series and compare simple baselines.', project: 'Build an inventory dashboard with assumptions and limitations.' },
      { id: 'logistics-operations', label: 'Logistics operations', focus: 'Workflow, capacity, service quality, and process improvement.', skills: ['Process mapping', 'Operations metrics', 'Communication', 'Planning'], tools: ['Process maps', 'Planning tools'], prerequisites: ['Basic operations concepts'], exercise: 'Map a fictional delivery workflow and identify a measurable bottleneck.', project: 'Propose a low-risk process improvement with a review measure.' },
    ],
  },
  {
    id: 'hospitality-tourism',
    label: 'Hospitality and tourism',
    roles: ['Hospitality Operations Analyst', 'Tourism Coordinator', 'Guest Experience Specialist', 'Travel Operations Planner'],
    matchSkills: ['hospitality', 'tourism', 'customer service', 'operations', 'communication', 'planning', 'spreadsheets', 'marketing'],
    interests: ['hospitality', 'tourism', 'travel', 'guest experience', 'service operations', 'events'],
    prerequisites: ['Customer service and communication', 'Role-specific safety and local requirements'],
    tools: ['Scheduling and booking systems', 'Spreadsheets'],
    responsibilities: ['Coordinate guest or traveler experiences, service delivery, and operational details.', 'Use feedback and operating information to improve quality and planning.'],
    workStyle: 'People-facing service, coordination, scheduling, practical problem solving, and feedback review.',
    projects: ['Design a sample visitor itinerary or service workflow and identify accessibility considerations.'],
    pathways: [
      { id: 'guest-experience', label: 'Guest experience and service design', focus: 'Guest needs, accessible journeys, service recovery, and quality.', skills: ['Communication', 'Journey mapping', 'Service recovery', 'Accessibility'], tools: ['Journey maps', 'Feedback forms'], prerequisites: ['Customer service fundamentals'], exercise: 'Map a fictional guest journey and improve one point of friction.', project: 'Create an accessible service blueprint with feedback measures.' },
      { id: 'tourism-operations', label: 'Tourism operations and planning', focus: 'Itinerary, capacity, logistics, and responsible visitor information.', skills: ['Planning', 'Scheduling', 'Risk awareness', 'Clear writing'], tools: ['Spreadsheets', 'Maps'], prerequisites: ['Organization and clear communication'], exercise: 'Plan a sample route with timing and accessibility assumptions.', project: 'Publish a responsible travel operations plan using public information.' },
    ],
  },
  {
    id: 'public-social-impact',
    label: 'Public services and social impact',
    roles: ['Policy Research Assistant', 'Public Services Analyst', 'Program Evaluation Assistant', 'Nonprofit Operations Coordinator'],
    matchSkills: ['public service', 'policy', 'research', 'data analysis', 'program evaluation', 'communication', 'operations', 'community engagement'],
    interests: ['public service', 'social impact', 'community', 'policy', 'nonprofit', 'civic technology', 'government'],
    prerequisites: ['Ethical community engagement', 'Careful handling of sensitive data'],
    tools: ['Spreadsheets', 'Research methods', 'Accessible communication tools'],
    responsibilities: ['Support public programs, research, or service delivery with evidence and community context.', 'Respect privacy, accessibility, and the limits of available data.'],
    workStyle: 'Research, stakeholder collaboration, program coordination, and clear public-facing communication.',
    projects: ['Analyze a public dataset or fictional program scenario and write a transparent, accessible summary.'],
    pathways: [
      { id: 'policy-research', label: 'Policy and public research', focus: 'Evidence review, context, and clear explanation of policy options.', skills: ['Research methods', 'Source evaluation', 'Data literacy', 'Writing'], tools: ['Public datasets', 'Reference tools'], prerequisites: ['Clear writing and research integrity'], exercise: 'Compare public sources and separate findings from assumptions.', project: 'Write a short policy brief with sources and uncertainty.' },
      { id: 'program-evaluation', label: 'Program evaluation and operations', focus: 'Program goals, indicators, delivery, and learning from outcomes.', skills: ['Program logic', 'Measurement', 'Spreadsheets', 'Stakeholder communication'], tools: ['Spreadsheets', 'Survey methods'], prerequisites: ['Basic analysis and ethical data handling'], exercise: 'Draft indicators for a fictional community program.', project: 'Create a small evaluation plan with privacy and inclusion considerations.' },
    ],
  },
];

const normalized = (value) => String(value || '').toLocaleLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').trim();

const educationSignals = {
  'software-development': ['computer science', 'software engineering', 'information technology', 'computer engineering', 'computer applications'],
  'data-analytics': ['computer science', 'statistics', 'mathematics', 'economics', 'business analytics', 'data science'],
  'artificial-intelligence': ['computer science', 'statistics', 'mathematics', 'data science', 'electrical engineering'],
  cybersecurity: ['computer science', 'information technology', 'network engineering', 'cybersecurity', 'information security'],
  'cloud-infrastructure': ['computer science', 'information technology', 'network engineering', 'systems engineering'],
  'software-quality': ['computer science', 'software engineering', 'information technology', 'quality engineering'],
  'design-product': ['design', 'human computer interaction', 'psychology', 'communication', 'technical writing'],
  'business-operations': ['business', 'management', 'human resources', 'operations', 'communications'],
  'finance-accounting': ['finance', 'accounting', 'economics', 'business', 'statistics'],
  'marketing-communications': ['marketing', 'communications', 'business', 'media', 'market research'],
  'education-research': ['education', 'teaching', 'research', 'learning design', 'instructional design'],
  'engineering-manufacturing': ['mechanical engineering', 'electrical engineering', 'industrial engineering', 'manufacturing engineering'],
  'healthcare-life-sciences': ['biology', 'life sciences', 'public health', 'health informatics', 'medicine'],
  'agriculture-environment': ['agriculture', 'environmental science', 'ecology', 'climate science', 'biology'],
  'logistics-supply-chain': ['supply chain', 'logistics', 'operations', 'industrial engineering', 'business'],
  'hospitality-tourism': ['hospitality', 'tourism', 'travel', 'event management', 'service management'],
  'public-social-impact': ['public policy', 'public administration', 'social work', 'community development', 'political science'],
};

function valuesFromProfile(profile) {
  const projects = Array.isArray(profile?.projects) ? profile.projects : [];
  const certifications = Array.isArray(profile?.certifications) ? profile.certifications : [];
  return {
    skills: Array.isArray(profile?.skills) ? profile.skills.filter((item) => typeof item === 'string') : [],
    interests: Array.isArray(profile?.interests) ? profile.interests.filter((item) => typeof item === 'string') : [],
    projects: projects.flatMap((project) => [project?.name, project?.description, project?.technologies]).filter((item) => typeof item === 'string' && item.trim()),
    certifications: certifications.flatMap((certification) => [certification?.name, certification?.issuer]).filter((item) => typeof item === 'string' && item.trim()),
    education: [profile?.degree, profile?.branch, profile?.education?.degree, profile?.education?.branch].filter((item) => typeof item === 'string' && item.trim()),
    experienceLevel: typeof profile?.experienceLevel === 'string' ? profile.experienceLevel : '',
    workAreas: [
      ...(Array.isArray(profile?.preferredWorkAreas) ? profile.preferredWorkAreas : []),
      ...(Array.isArray(profile?.preferredIndustries) ? profile.preferredIndustries : []),
      ...(Array.isArray(profile?.careerInterests) ? profile.careerInterests : []),
    ].filter((item) => typeof item === 'string' && item.trim()),
  };
}

function containsTerm(value, term) {
  const haystack = ` ${normalized(value)} `;
  const needle = ` ${normalized(term)} `;
  return needle.length > 2 && haystack.includes(needle);
}

function findMatches(values, terms) {
  return values.filter((value) => terms.some((term) => containsTerm(value, term)));
}

export const careerDomains = domains;
export const careerRoles = domains.flatMap((domain) => domain.roles.map((title) => ({
  id: `${domain.id}:${normalized(title).replaceAll(' ', '-')}`,
  title,
  domainId: domain.id,
  domainLabel: domain.label,
})))
  .concat([
    { id: 'other:custom-career', title: 'Other career', domainId: 'other', domainLabel: 'Other careers' },
  ]);

export function getCareerDomain(roleOrId) {
  const value = String(roleOrId || '');
  const role = careerRoles.find((item) => item.id === value || item.title.toLocaleLowerCase() === value.toLocaleLowerCase());
  return role ? domains.find((domain) => domain.id === role.domainId) || null : null;
}

export function getCareerRole(roleOrId) {
  const value = String(roleOrId || '');
  return careerRoles.find((item) => item.id === value || item.title.toLocaleLowerCase() === value.toLocaleLowerCase()) || null;
}

export function getCareerPathways(roleOrId) {
  const role = getCareerRole(roleOrId);
  const domain = role && domains.find((item) => item.id === role.domainId);
  if (!domain) return [];
  const pathways = domain.pathways.filter((pathway) => !pathway.roles || pathway.roles.includes(role.title));
  return pathways.length ? pathways : domain.pathways.slice(0, 1);
}

export function getCareerPathway(roleOrId, pathwayId) {
  return getCareerPathways(roleOrId).find((pathway) => pathway.id === pathwayId) || getCareerPathways(roleOrId)[0] || null;
}

export function matchProfileToCareers(profile, maximum = 20) {
  const values = valuesFromProfile(profile);
  const matches = [];
  for (const domain of domains) {
    for (const roleTitle of domain.roles) {
      const roleTerms = [roleTitle, ...domain.matchSkills];
      const skillMatches = findMatches(values.skills, roleTerms);
      const projectMatches = findMatches(values.projects, roleTerms);
      const certificationMatches = findMatches(values.certifications, roleTerms);
      const interestMatches = findMatches(values.interests, [roleTitle, domain.label, ...domain.interests]);
      const workAreaMatches = findMatches(values.workAreas, [roleTitle, domain.label, ...domain.interests]);
      const educationMatches = findMatches(values.education, educationSignals[domain.id] || []);
      const evidenceCount = skillMatches.length + projectMatches.length + certificationMatches.length + interestMatches.length + workAreaMatches.length;
      if (evidenceCount === 0 && educationMatches.length === 0) continue;

      const score = Math.min(96, skillMatches.length * 17
        + projectMatches.length * 13
        + certificationMatches.length * 10
        + interestMatches.length * 12
        + workAreaMatches.length * 14
        + educationMatches.length * 5);
      const role = getCareerRole(roleTitle);
      matches.push({
        ...role,
        score,
        skillMatches: [...new Set(skillMatches)],
        projectMatches: [...new Set(projectMatches)],
        certificationMatches: [...new Set(certificationMatches)],
        interestMatches: [...new Set(interestMatches)],
        workAreaMatches: [...new Set(workAreaMatches)],
        educationMatches: [...new Set(educationMatches)],
        experienceLevel: values.experienceLevel,
      });
    }
  }

  matches.sort((first, second) => second.score - first.score || first.title.localeCompare(second.title));
  const selected = [];
  const seenDomains = new Set();
  for (const match of matches) {
    if (selected.length >= maximum) break;
    if (!seenDomains.has(match.domainId)) {
      selected.push(match);
      seenDomains.add(match.domainId);
    }
  }
  for (const match of matches) {
    if (selected.length >= maximum) break;
    if (!selected.some((item) => item.id === match.id)) selected.push(match);
  }
  return selected;
}

export function buildCareerRecommendation(match) {
  const role = getCareerRole(match?.id || match?.title);
  const domain = role && domains.find((item) => item.id === role.domainId);
  if (!role || !domain) return null;

  const pathway = getCareerPathways(role.id)[0];
  const savedSkills = new Set([
    ...(match.skillMatches || []),
    ...(match.projectMatches || []),
    ...(match.certificationMatches || []),
  ].map(normalized));
  const skillSequence = [...new Set([...(pathway?.skills || []), ...domain.matchSkills.slice(0, 4)])];
  const missingSkills = skillSequence.filter((skill) => ![...savedSkills].some((saved) => saved === normalized(skill) || saved.includes(normalized(skill)) || normalized(skill).includes(saved)));
  const evidence = [];
  if (match.skillMatches?.length) evidence.push(`skills such as ${match.skillMatches.slice(0, 3).join(', ')}`);
  if (match.projectMatches?.length) evidence.push(`project work mentioning ${match.projectMatches.slice(0, 2).join(', ')}`);
  if (match.interestMatches?.length || match.workAreaMatches?.length) evidence.push('your stated career interests');
  if (match.educationMatches?.length) evidence.push('your education background');
  if (!evidence.length) evidence.push('the profile evidence connected to this role');
  const experienceNote = match.experienceLevel
    ? ` Your saved experience level is ${match.experienceLevel}; confirm role-specific prerequisites as you explore.`
    : '';

  return {
    careerId: role.id,
    careerDomain: domain.label,
    careerPath: role.title,
    compatibilityScore: match.score,
    whyItSuits: `This path connects to ${evidence.join(', ')}. This is a learning-fit estimate, not a hiring prediction.${experienceNote}`,
    relevantSkills: [...new Set([...(match.skillMatches || []), ...(match.projectMatches || [])])].slice(0, 8),
    transferableSkills: [...new Set([...(match.skillMatches || []), ...(match.interestMatches || [])])].slice(0, 8),
    missingSkills,
    prerequisites: [...domain.prerequisites],
    toolsAndTechnologies: [...domain.tools],
    responsibilities: [...domain.responsibilities],
    workStyle: domain.workStyle,
    specializations: domain.pathways.map((item) => item.label),
    careerPathways: domain.pathways.map(({ id, label, focus }) => ({ id, label, focus })),
    skillLearningPlan: missingSkills.map((skill, index) => ({
      skill,
      priority: index < 2 ? 'Beginner' : index < 5 ? 'Intermediate' : 'Advanced',
      sequenceOrder: index + 1,
    })),
    learningRoadmap: (pathway?.skills || domain.matchSkills.slice(0, 5)).map((skill, index) => ({
      phase: `Stage ${index + 1}: ${skill}`,
      timeframe: index === 0 ? 'Start here' : 'Next step',
      actions: [
        `${skill} matters for ${role.title} because it supports ${pathway?.focus || domain.label.toLocaleLowerCase()}.`,
        index === 0 ? 'Start with a small guided exercise and note what you can already do.' : 'Practice the skill in a small, reviewable exercise before adding complexity.',
      ],
    })),
    suggestedPortfolioProject: domain.projects[0],
    projectIdeas: [...domain.projects],
    nextSteps: [
      `Compare the ${pathway?.label || domain.label} pathway with your current goals.`,
      `Practice ${missingSkills[0] || pathway?.skills?.[0] || 'a foundational topic'} with a small project.`,
      'Review your profile as your skills and interests change.',
    ],
    generationMethod: 'rule-based',
  };
}

export function createRuleBasedRecommendations(profile, maximum = 5) {
  return {
    careerRecommendations: matchProfileToCareers(profile, maximum)
      .map(buildCareerRecommendation)
      .filter(Boolean),
    generationMethod: 'rule-based',
  };
}

export function buildCareerLearningPlan(roleOrId, pathwayId, profile = {}) {
  const role = getCareerRole(roleOrId);
  const domain = role && domains.find((item) => item.id === role.domainId);
  const pathway = role && getCareerPathway(role.id, pathwayId);
  if (!role || !domain || !pathway) return null;
  const profileValues = valuesFromProfile(profile);
  const known = [
    ...profileValues.skills,
    ...profileValues.projects.flatMap((value) => value.split(/[;,\s]+/)),
    ...profileValues.certifications.flatMap((value) => value.split(/[;,\s]+/)),
    ...profileValues.education.flatMap((value) => value.split(/[;,\s]+/)),
  ];
  return {
    careerId: role.id,
    careerPath: role.title,
    careerDomain: domain.label,
    pathwayId: pathway.id,
    pathwayName: pathway.label,
    pathwayFocus: pathway.focus,
    whyChoose: pathway.focus,
    prerequisites: [...pathway.prerequisites],
    toolsAndTechnologies: [...pathway.tools],
    projectMilestone: pathway.project,
    projectIdeas: [...domain.projects],
    steps: pathway.skills.map((skill, index) => ({
      skill,
      sequenceOrder: index + 1,
      priority: index < 2 ? 'Beginner' : index < 4 ? 'Intermediate' : 'Advanced',
      whyItMatters: `${skill} supports ${pathway.focus}`,
      reusedSkills: known.filter((item) => containsTerm(item, skill) || containsTerm(skill, item)).slice(0, 4),
      newSkills: known.some((item) => containsTerm(item, skill) || containsTerm(skill, item)) ? [] : [skill],
      prerequisites: index === 0 ? [...pathway.prerequisites] : [pathway.skills[index - 1]],
      exercise: pathway.exercise,
      projectMilestone: index === pathway.skills.length - 1 ? pathway.project : `Apply ${skill} in a small exercise that contributes to: ${pathway.project}`,
      resourceIds: [],
      youtubeTopic: skill,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function getCareerProgressDocumentId(careerPath, skill) {
  return encodeURIComponent(`${careerPath}::${skill}`);
}