/**
 * Aura AI Tutor - Floating Chatbot Companion
 * Supports offline keyword matching, interactive quizzes, career guidance, 
 * time-based preparation roadmaps, and direct client-side Gemini API integration 
 * with conversation history (memory) to answer any type of question.
 */

(function() {
    // Safe Storage helper to prevent SecurityError in restricted environments
    const safeStorage = {
        getItem(key) {
            try {
                return localStorage.getItem(key);
            } catch (e) {
                console.warn("localStorage access blocked. Using in-memory fallback.");
                return null;
            }
        },
        setItem(key, value) {
            try {
                localStorage.setItem(key, value);
            } catch (e) {
                // Fallback silently
            }
        }
    };

    // 1. Initial State & Configuration
    let config = {
        mode: safeStorage.getItem('aura_mode') || 'offline', // 'offline' or 'gemini'
        apiKey: safeStorage.getItem('aura_api_key') || '',
        userName: safeStorage.getItem('aura_user_name') || 'Student'
    };

    // Conversational History Memory
    let chatHistory = [];
    let isTyping = false;
    
    // Quiz State Tracker
    let quizState = {
        active: false,
        subject: '',
        questions: [],
        questionIndex: 0,
        score: 0
    };

    // Multi-subject Question Banks (4 questions per subject, quiz draws 3 at random)
    const QUIZ_BANKS = {
        html: [
            {
                q: "Which HTML5 element is used for semantic main content?",
                options: { A: "<content>", B: "<main>", C: "<section>" },
                correct: "B",
                exp: "The <main> element is the semantic container that wraps the primary dominant content of a document."
            },
            {
                q: "What attribute is used to open a hyperlink in a new tab?",
                options: { A: "target='_blank'", B: "rel='newtab'", C: "href='blank'" },
                correct: "A",
                exp: "Setting target='_blank' tells the browser to load the destination URL in a new window or tab."
            },
            {
                q: "Which element is used to group related form controls together?",
                options: { A: "<fieldset>", B: "<group>", C: "<formgroup>" },
                correct: "A",
                exp: "The <fieldset> element groups several controls and labels within a web form, often styled with a border."
            },
            {
                q: "What is the correct tag for a line break?",
                options: { A: "<break>", B: "<lb>", C: "<br>" },
                correct: "C",
                exp: "The <br> tag is an empty/self-closing element used to force a line break in text."
            }
        ],
        css: [
            {
                q: "Which CSS property controls the text size?",
                options: { A: "font-style", B: "font-size", C: "text-size" },
                correct: "B",
                exp: "The 'font-size' property adjusts the dimensions of text characters (e.g. in px, em, or rem)."
            },
            {
                q: "How do you display a grid layout in CSS?",
                options: { A: "display: grid;", B: "layout: grid;", C: "grid: active;" },
                correct: "A",
                exp: "Setting display: grid; turns an element into a grid container, enabling grid item placement."
            },
            {
                q: "What does 'z-index' control in CSS layout?",
                options: { A: "Horizontal overlap", B: "Vertical alignment", C: "Stack order depth" },
                correct: "C",
                exp: "The z-index property specifies the stack order of positioned elements along the 3D Z-axis."
            },
            {
                q: "Which selector selects all elements of a specific CSS class?",
                options: { A: ".classname", B: "#classname", C: "classname" },
                correct: "A",
                exp: "A dot (.) prefix is used in CSS to target elements containing that class name."
            }
        ],
        js: [
            {
                q: "What is the result of typeof null in JavaScript?",
                options: { A: "'null'", B: "'undefined'", C: "'object'" },
                correct: "C",
                exp: "In JavaScript, typeof null returns 'object'. This is a well-known legacy quirk of the language."
            },
            {
                q: "Which function converts a string representation of a number to an integer?",
                options: { A: "parseInt()", B: "Number.cast()", C: "toInteger()" },
                correct: "A",
                exp: "The global parseInt() function parses a string argument and returns an integer of the specified radix."
            },
            {
                q: "Which keyword declares a block-scoped local variable?",
                options: { A: "var", B: "let", C: "local" },
                correct: "B",
                exp: "The 'let' keyword declares block-scoped variables. 'var' is function-scoped."
            },
            {
                q: "How do you write a single-line comment in JavaScript?",
                options: { A: "<!-- comment -->", B: "// comment", C: "# comment" },
                correct: "B",
                exp: "Double forward slashes (//) denote a single-line comment in JavaScript."
            }
        ],
        python: [
            {
                q: "How do you define a function in Python?",
                options: { A: "function name():", B: "def name():", C: "void name():" },
                correct: "B",
                exp: "Python uses the 'def' keyword followed by the function name, parentheses, and a colon."
            },
            {
                q: "What is the output of len([1, 2, 3]) in Python?",
                options: { A: "3", B: "2", C: "Error" },
                correct: "A",
                exp: "The len() function returns the total number of items in a list or characters in a string."
            },
            {
                q: "Which Python data structure is mutable and stores key-value pairs?",
                options: { A: "List", B: "Tuple", C: "Dictionary" },
                correct: "C",
                exp: "A Dictionary (dict) is a mutable data structure containing key-value associations enclosed in curly braces {}."
            },
            {
                q: "How do you append an item to the end of a list in Python?",
                options: { A: "list.add(item)", B: "list.append(item)", C: "list.insert(item)" },
                correct: "B",
                exp: "The .append() method adds a single element to the very end of an existing list."
            }
        ],
        sql: [
            {
                q: "Which SQL clause filters groups after aggregation?",
                options: { A: "WHERE", B: "HAVING", C: "GROUP BY" },
                correct: "B",
                exp: "HAVING filters summary/aggregated rows (after GROUP BY), whereas WHERE filters individual records before aggregation."
            },
            {
                q: "What SQL statement removes all data from a table without deleting the schema?",
                options: { A: "DELETE SCHEMA", B: "TRUNCATE TABLE", C: "DROP TABLE" },
                correct: "B",
                exp: "TRUNCATE TABLE quickly removes all rows from a table while keeping the table structure and indexes intact."
            },
            {
                q: "Which JOIN returns all rows from the left table and matched rows from the right?",
                options: { A: "LEFT JOIN", B: "RIGHT JOIN", C: "INNER JOIN" },
                correct: "A",
                exp: "LEFT JOIN returns all records from the left table, and the matched records from the right. Unmatched columns return NULL."
            },
            {
                q: "What is a primary key constraint used for in SQL database schemas?",
                options: { A: "Uniquely identifying rows", B: "Query indexing only", C: "Default values" },
                correct: "A",
                exp: "A PRIMARY KEY column uniquely identifies each row in a table. It cannot contain NULL values."
            }
        ],
        c: [
            {
                q: "How do you declare a pointer variable in C?",
                options: { A: "int &p;", B: "int *p;", C: "pointer p;" },
                correct: "B",
                exp: "An asterisk (*) prefix is used to declare a variable as a pointer of a specific data type."
            },
            {
                q: "Which operator gets the memory address of a variable in C?",
                options: { A: "*", B: "&", C: "@" },
                correct: "B",
                exp: "The ampersand (&) operator is the address-of operator, yielding the memory address of a variable."
            },
            {
                q: "What C function allocates memory dynamically from the heap?",
                options: { A: "alloc()", B: "malloc()", C: "call()" },
                correct: "B",
                exp: "malloc() (memory allocation) takes a byte size parameter and returns a void pointer to the allocated block."
            },
            {
                q: "What does the C function free(p) do?",
                options: { A: "Erases pointer value", B: "Deallocates memory block", C: "Sets pointer to null" },
                correct: "B",
                exp: "free() releases the dynamically allocated block of memory pointed to by its pointer parameter."
            }
        ],
        dsa: [
            {
                q: "What is the average time complexity of a Binary Search?",
                options: { A: "O(N)", B: "O(log N)", C: "O(1)" },
                correct: "B",
                exp: "Binary search halves the search space at each step, resulting in a logarithmic time complexity of O(log N)."
            },
            {
                q: "Which data structure operates on a Last-In, First-Out (LIFO) basis?",
                options: { A: "Queue", B: "Stack", C: "Heap" },
                correct: "B",
                exp: "A Stack processes items in LIFO order—insertions (push) and deletions (pop) occur at the top of the stack."
            },
            {
                q: "What data structure has nodes containing a value and left/right child pointers?",
                options: { A: "Graph", B: "Binary Tree", C: "Matrix" },
                correct: "B",
                exp: "A Binary Tree is a hierarchical structure where each node has at most two child nodes (left and right)."
            },
            {
                q: "What is the worst-case time complexity of a Bubble Sort?",
                options: { A: "O(N)", B: "O(N log N)", C: "O(N²)" },
                correct: "C",
                exp: "Bubble Sort compares adjacent elements and swaps them, requiring nested loops that yield O(N²) worst-case time complexity."
            }
        ]
    };

    // Career Guide Database
    const CAREER_GUIDE = {
        frontend: {
            title: "Frontend Developer",
            desc: "Focuses on user-facing visual interfaces, layout structures, and page interactions.",
            prereqs: "HTML, CSS (Flexbox/Grid), JavaScript (ES6+), React/Vue/Svelte, Git",
            link: "reference.html?career=frontend"
        },
        backend: {
            title: "Backend Developer",
            desc: "Manages server-side application logic, database integrations, authentication, and APIs.",
            prereqs: "Node.js/Python/Java/Go, Databases (SQL/NoSQL), REST APIs, Docker, Git",
            link: "reference.html?career=backend"
        },
        datascience: {
            title: "Data Scientist / ML Engineer",
            desc: "Analyzes datasets to build predictive machine learning models and data pipelines.",
            prereqs: "Python (Pandas/NumPy/Scikit-Learn), SQL, Statistics, Linear Algebra",
            link: "reference.html?career=datascience"
        },
        cybersecurity: {
            title: "Cybersecurity Specialist",
            desc: "Protects systems, networks, and data programs from digital attacks and vulnerabilities.",
            prereqs: "Networking, Linux CLI, OWASP Top 10, Cryptography, Scripting (Python/Bash)",
            link: "reference.html?career=cybersecurity"
        }
    };

    // Preparation plans details for chatbot response overrides
    const PLAN_DETAILS = {
        frontend: {
            3: `*   **Month 1 (Foundations)**: Learn HTML & CSS layout structures. Practice creating responsive mockups.\n*   **Month 2 (Javascript)**: Study DOM manipulation, API fetching, and JavaScript arrays.\n*   **Month 3 (Framework & Launch)**: Build simple React apps and deploy your personal portfolio.`,
            6: `*   **Months 1-2 (HTML & CSS)**: Master Flexbox, Grid, CSS animations, and building responsive page layouts.\n*   **Months 3-4 (JS Deep Dive)**: Understand variables, async/await, Promises, and fetch requests.\n*   **Months 5-6 (React & Deployment)**: Learn a frontend framework (React/Vite) and build 3 production-ready projects.`,
            12: `*   **Months 1-3 (Programming Intro)**: Learn programming logic, basic markup syntax, and write basic scripts.\n*   **Months 4-6 (Web Design)**: Deep-dive into design systems, Git workflow, and responsive styling.\n*   **Months 7-9 (JavaScript & APIs)**: Build complex scripts, integrate with backend database endpoints, and study web performance.\n*   **Months 10-12 (Frameworks & Portfolios)**: Learn React/Next.js, write testing configurations, complete 3 major projects, and prepare for interviews.`
        },
        backend: {
            3: `*   **Month 1 (Language basics)**: Learn Node.js/Python programming syntax and HTTP methods.\n*   **Month 2 (Databases)**: Master relational SQL queries, table schemas, and database normalization.\n*   **Month 3 (API & Auth)**: Implement JWT authentication, build REST endpoints, and deploy to cloud servers.`,
            6: `*   **Months 1-2 (Backend Core)**: Master Node.js/Python, routing configurations, and JSON payloads.\n*   **Months 3-4 (Databases & ORMs)**: Learn relational SQL (Postgres) and NoSQL (MongoDB), database indexing, and ORM tools.\n*   **Months 5-6 (Security & Deploy)**: Master JWT token security, cookies, environment variables, unit testing, and Docker.`,
            12: `*   **Months 1-3 (CS Basics)**: Lay down programming logic foundation, learn pointers/memory, and basic algorithms.\n*   **Months 4-6 (Backend Execution)**: Setup local servers, learn HTTP routing, and practice basic SQL statements.\n*   **Months 7-9 (System Design)**: Study backend architecture, caching models (Redis), database scaling, and authentication protocols.\n*   **Months 10-12 (Production Systems)**: Learn Docker, message brokers (RabbitMQ), unit tests, complete 3 backend applications, and practice mock coding interviews.`
        },
        datascience: {
            3: `*   **Month 1 (Python & Math)**: Master Python syntaxes, probability, and linear algebra basics.\n*   **Month 2 (Data Analytics)**: Learn Pandas/NumPy, data cleaning procedures, and SQL queries.\n*   **Month 3 (Machine Learning)**: Study supervised model training (Scikit-Learn) and build a basic prediction system.`,
            6: `*   **Months 1-2 (Python & SQL)**: Learn data processing libraries (Pandas/NumPy), SQL joins, and data visualization.\n*   **Months 3-4 (Applied Math)**: Master probability distributions, calculus optimization, and statistical modeling.\n*   **Months 5-6 (Machine Learning)**: Build supervised/unsupervised training pipelines, tune hyperparameters, and deploy 2 ML portfolios.`,
            12: `*   **Months 1-3 (Math & Scripting)**: Study probability, linear algebra, and basic Python programming.\n*   **Months 4-6 (Data pipelines)**: Learn SQL databases, ETL data engineering, and data cleaning pipelines.\n*   **Months 7-9 (ML Algorithms)**: Master model tuning, regression, decision trees, and neural networks.\n*   **Months 10-12 (Deep Learning & NLP)**: Study PyTorch/TensorFlow, train complex models, complete 3 research portfolios, and prep data science interviews.`
        },
        cybersecurity: {
            3: `*   **Month 1 (Networking)**: Learn networking administration, TCP/IP, and Linux CLI navigation.\n*   **Month 2 (Security Tools)**: Study OWASP top vulnerabilities and basic pentesting tools (Nmap/Wireshark).\n*   **Month 3 (Security Policy)**: Learn basic cryptography, access control, and prepare security audit reports.`,
            6: `*   **Months 1-2 (Network Admin)**: Master networking layouts, Linux CLI bash scripting, and administrative controls.\n*   **Months 3-4 (Vulnerabilities)**: Learn cryptography protocols, SSL, threat analysis, and firewall rules.\n*   **Months 5-6 (Cert Prep & Hacking)**: Practice ethical hacking exercises, learn compliance frameworks, and study for CompTIA Security+.`,
            12: `*   **Months 1-3 (CS & Networks)**: Understand low-level C programming, pointers, operating system files, and TCP/IP routing.\n*   **Months 4-6 (SecOps Core)**: Master cryptography algorithms, Linux/Windows administration, and SQL injection prevention.\n*   **Months 7-9 (Penetration Testing)**: Complete advanced lab trials using Kali Linux tools, Wireshark packet audits, and vulnerability scanners.\n*   **Months 10-12 (Compliance & Jobs)**: Study NIST/ISO compliance audits, cloud security best practices, compile security portfolio documents, and practice cybersecurity interviews.`
        }
    };

    // 2. Initialize UI elements
    function initUI() {
        if (document.getElementById('aura-chatbot-container')) return;

        const container = document.createElement('div');
        container.id = 'aura-chatbot-container';
        container.innerHTML = `
            <!-- Floating Button -->
            <button id="aura-chat-toggle" title="Chat with Aura AI Tutor">
                💬
            </button>

            <!-- Chat Window -->
            <div id="aura-chat-window">
                <!-- Header -->
                <div class="aura-chat-header">
                    <div class="aura-chat-header-info">
                        <div class="aura-chat-avatar">🤖</div>
                        <div class="aura-chat-header-text">
                            <h4>Aura AI Tutor</h4>
                            <div class="aura-chat-status">
                                <span class="aura-status-dot"></span>
                                <span id="aura-status-text">Offline Mode</span>
                            </div>
                        </div>
                    </div>
                    <div class="aura-chat-actions">
                        <button id="aura-chat-settings-btn" class="aura-chat-action-btn" title="AI Settings">⚙️</button>
                        <button id="aura-chat-minimize-btn" class="aura-chat-action-btn" title="Minimize">✖</button>
                    </div>
                </div>

                <!-- Settings Panel -->
                <div id="aura-chat-settings-panel">
                    <div class="aura-settings-header">
                        <h3>⚙️ Aura Config Panel</h3>
                        <button id="aura-settings-close" class="aura-chat-action-btn" style="color:var(--text-body)">✖</button>
                    </div>
                    <div class="aura-settings-body">
                        <div class="aura-form-group">
                            <label for="aura-mode-select">🤖 Tutor Mode</label>
                            <select id="aura-mode-select" class="aura-mode-select">
                                <option value="offline">Offline Mode (Rule-based & Quizzes)</option>
                                <option value="gemini">Gemini LLM Mode (Answers ANY type of question)</option>
                            </select>
                        </div>
                        <div class="aura-form-group" id="aura-api-key-group" style="display:none;">
                            <label for="aura-api-key-input">🔑 Gemini API Key</label>
                            <input type="password" id="aura-api-key-input" class="aura-settings-input" placeholder="Paste AI Studio API Key here...">
                            <span class="aura-settings-help">
                                Get a free key from <a href="https://aistudio.google.com/" target="_blank">Google AI Studio</a>. This enables Aura to answer any custom code debugging, conceptual, or general knowledge questions.
                            </span>
                        </div>
                        <div class="aura-form-group">
                            <label for="aura-username-input">👤 Your Name</label>
                            <input type="text" id="aura-username-input" class="aura-settings-input" placeholder="Enter name...">
                        </div>
                    </div>
                    <div class="aura-settings-footer">
                        <button id="aura-settings-save" class="aura-btn primary">Save Changes</button>
                    </div>
                </div>

                <!-- Chat Messages Body -->
                <div class="aura-chat-body" id="aura-chat-body">
                    <!-- Dynamic Messages will append here -->
                </div>

                <!-- Footer Input -->
                <div class="aura-chat-footer">
                    <div class="aura-chat-input-wrapper">
                        <input type="text" id="aura-chat-input" placeholder="Ask Aura a question..." autocomplete="off">
                    </div>
                    <button id="aura-chat-send" title="Send message" disabled>
                        ➤
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        bindEvents();
        applySettingsUI();
        sendBotWelcome();
    }

    // Bind Event Listeners
    function bindEvents() {
        const toggleBtn = document.getElementById('aura-chat-toggle');
        const minBtn = document.getElementById('aura-chat-minimize-btn');
        const settingsBtn = document.getElementById('aura-chat-settings-btn');
        const settingsCloseBtn = document.getElementById('aura-settings-close');
        const saveSettingsBtn = document.getElementById('aura-settings-save');
        const chatInput = document.getElementById('aura-chat-input');
        const sendBtn = document.getElementById('aura-chat-send');
        const modeSelect = document.getElementById('aura-mode-select');

        toggleBtn.addEventListener('click', toggleChatWindow);
        minBtn.addEventListener('click', toggleChatWindow);

        settingsBtn.addEventListener('click', () => {
            document.getElementById('aura-chat-settings-panel').classList.add('active');
        });
        settingsCloseBtn.addEventListener('click', () => {
            document.getElementById('aura-chat-settings-panel').classList.remove('active');
        });

        modeSelect.addEventListener('change', (e) => {
            const apiKeyGroup = document.getElementById('aura-api-key-group');
            apiKeyGroup.style.display = e.target.value === 'gemini' ? 'flex' : 'none';
        });

        saveSettingsBtn.addEventListener('click', () => {
            const newMode = modeSelect.value;
            const newKey = document.getElementById('aura-api-key-input').value.trim();
            const newName = document.getElementById('aura-username-input').value.trim() || 'Student';

            if (newMode === 'gemini' && !newKey) {
                alert("Please paste your Gemini API Key to enable Gemini Mode, or choose Offline Mode!");
                return;
            }

            config.mode = newMode;
            config.apiKey = newKey;
            config.userName = newName;

            safeStorage.setItem('aura_mode', newMode);
            safeStorage.setItem('aura_api_key', newKey);
            safeStorage.setItem('aura_user_name', newName);

            // Sync settings to backend if logged in
            const email = safeStorage.getItem('studentEmail');
            const isBackendAvailable = window.location.protocol.startsWith('http');
            if (isBackendAvailable && email) {
                const apiBase = window.location.protocol.startsWith('http') ? '' : 'https://127.0.0.1';
                fetch(`${apiBase}/api/chatbot`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email,
                        aura_mode: newMode,
                        aura_api_key: newKey,
                        aura_user_name: newName
                    })
                }).catch(err => console.warn("Could not sync chatbot settings to backend:", err));
            }

            applySettingsUI();
            
            appendSystemMessage("Settings saved successfully.");
            document.getElementById('aura-chat-settings-panel').classList.remove('active');

            chatHistory = [];

            if (newMode === 'gemini') {
                sendBotMessage(`I am now running in **Gemini AI Mode**! 🤖\n\nYou can now ask me **any type of questions** (e.g. general science, custom coding help, debugging, interview prep, math help, or writing templates). How can I assist you?`);
            } else {
                sendBotMessage(`I am now running in **Offline Smart Mode**! 🎓`);
            }
        });

        chatInput.addEventListener('input', (e) => {
            sendBtn.disabled = e.target.value.trim() === '';
        });

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && chatInput.value.trim() !== '') {
                handleUserSend();
            }
        });

        sendBtn.addEventListener('click', handleUserSend);
    }

    // Toggle Chat window
    function toggleChatWindow() {
        const toggleBtn = document.getElementById('aura-chat-toggle');
        const chatWindow = document.getElementById('aura-chat-window');
        
        toggleBtn.classList.toggle('active');
        chatWindow.classList.toggle('active');

        if (chatWindow.classList.contains('active')) {
            document.getElementById('aura-chat-input').focus();
            const body = document.getElementById('aura-chat-body');
            body.scrollTop = body.scrollHeight;
        }
    }

    // Apply config settings
    function applySettingsUI() {
        const statusText = document.getElementById('aura-status-text');
        const selectMode = document.getElementById('aura-mode-select');
        const apiKeyInput = document.getElementById('aura-api-key-input');
        const usernameInput = document.getElementById('aura-username-input');

        if (config.mode === 'gemini' && config.apiKey) {
            statusText.textContent = "Gemini AI Active";
        } else {
            statusText.textContent = "Offline Smart Tutor";
            config.mode = 'offline';
            safeStorage.setItem('aura_mode', 'offline');
        }

        selectMode.value = config.mode;
        apiKeyInput.value = config.apiKey;
        usernameInput.value = config.userName;

        document.getElementById('aura-api-key-group').style.display = config.mode === 'gemini' ? 'flex' : 'none';
    }

    // Render system bubble
    function appendSystemMessage(text) {
        const body = document.getElementById('aura-chat-body');
        const msgDiv = document.createElement('div');
        msgDiv.className = 'aura-message system';
        msgDiv.textContent = text;
        body.appendChild(msgDiv);
        body.scrollTop = body.scrollHeight;
    }

    // Render bot speech
    function sendBotMessage(text, chips = []) {
        const body = document.getElementById('aura-chat-body');
        
        hideTyping();

        const msgDiv = document.createElement('div');
        msgDiv.className = 'aura-message bot';
        
        msgDiv.innerHTML = formatMarkdown(text);
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'aura-message-time';
        timeSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        msgDiv.appendChild(timeSpan);

        body.appendChild(msgDiv);

        if (chips.length > 0) {
            const chipsDiv = document.createElement('div');
            chipsDiv.className = 'aura-chips-container';
            chips.forEach(chip => {
                const btn = document.createElement('button');
                btn.className = 'aura-chip';
                btn.textContent = chip.text;
                btn.addEventListener('click', () => {
                    handleChipClick(chip.action, chip.text);
                });
                chipsDiv.appendChild(btn);
            });
            body.appendChild(chipsDiv);
        }

        body.scrollTop = body.scrollHeight;
    }

    // Send Bot Welcome
    function sendBotWelcome() {
        const welcome = `Hello **${config.userName}**! I am **Aura**, your dedicated AI Study Tutor. 🎓

In **Gemini AI Mode**, I can answer **ANY type of questions** (e.g. debugging, general knowledge, essay reviews, math help). Paste a free key in the settings (gear icon) to unlock this!

In **Offline Mode**, I can guide you through subject roadmaps, quiz you, or suggest career tracks.`;

        sendBotMessage(welcome, [
            { text: "🎯 Career Guide", action: "start_careers" },
            { text: "📝 Take a Quiz", action: "start_quiz" },
            { text: "💡 Explain DSA", action: "explain_dsa" },
            { text: "🛠️ Recommend Project", action: "explain_project" }
        ]);
    }

    // User Message Sender
    function handleUserSend() {
        const input = document.getElementById('aura-chat-input');
        const userText = input.value.trim();
        if (userText === '') return;

        input.value = '';
        document.getElementById('aura-chat-send').disabled = true;

        appendUserMessage(userText);
        showTyping();

        if (quizState.active) {
            handleQuizTextAnswer(userText);
            return;
        }

        setTimeout(() => {
            if (config.mode === 'gemini' && config.apiKey) {
                queryGemini(userText);
            } else {
                handleOfflineResponse(userText);
            }
        }, 600);
    }

    function appendUserMessage(text) {
        const body = document.getElementById('aura-chat-body');
        const msgDiv = document.createElement('div');
        msgDiv.className = 'aura-message user';
        msgDiv.textContent = text;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'aura-message-time';
        timeSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        msgDiv.appendChild(timeSpan);

        body.appendChild(msgDiv);
        body.scrollTop = body.scrollHeight;
    }

    // Display Typing animation
    function showTyping() {
        if (isTyping) return;
        isTyping = true;
        const body = document.getElementById('aura-chat-body');
        const indicator = document.createElement('div');
        indicator.className = 'aura-typing-indicator';
        indicator.id = 'aura-typing-indicator';
        indicator.innerHTML = `
            <div class="aura-typing-dot"></div>
            <div class="aura-typing-dot"></div>
            <div class="aura-typing-dot"></div>
        `;
        body.appendChild(indicator);
        body.scrollTop = body.scrollHeight;
    }

    // Remove Typing animation
    function hideTyping() {
        isTyping = false;
        const indicator = document.getElementById('aura-typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    // Format markdown into HTML
    function formatMarkdown(text) {
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Code blocks: ```lang ... ```
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(match, lang, code) {
            return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
        });

        // Inline code: `code`
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Headers
        html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');

        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Italics
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Bullet lists
        html = html.replace(/^\s*[\*\-]\s+(.*)$/gm, '<li>$1</li>');

        // Wrap contiguous groups of <li> elements into <ul>
        html = html.replace(/(?:<li>.*<\/li>\s*)+/g, function(match) {
            return `<ul>${match}</ul>`;
        });

        // Clean newlines
        const preBlocks = [];
        html = html.replace(/<pre>[\s\S]*?<\/pre>/g, function(match) {
            preBlocks.push(match);
            return `__PRE_BLOCK_${preBlocks.length - 1}__`;
        });

        html = html.replace(/\n/g, '<br>');

        preBlocks.forEach((block, idx) => {
            html = html.replace(`__PRE_BLOCK_${idx}__`, block);
        });

        return html;
    }

    // Helper to shuffle array (Fisher-Yates)
    function shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Handle Prompt Chip Clicks
    function handleChipClick(action, label) {
        // Disable all chips in the active group to prevent double-clicks
        const lastContainer = document.querySelector('.aura-chips-container:last-of-type');
        if (lastContainer) {
            const buttons = lastContainer.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = 0.5;
                btn.style.cursor = 'not-allowed';
            });
        }

        appendUserMessage(label);
        showTyping();
        
        setTimeout(() => {
            if (action === "start_careers") {
                startCareerGuide();
            } else if (action === "start_quiz") {
                startQuiz();
            } else if (action === "explain_dsa") {
                explainDSABasics();
            } else if (action === "explain_project") {
                explainProjectIdeas();
            } else if (action.startsWith("select_career_")) {
                const key = action.replace("select_career_", "");
                showSpecificCareerGuide(key);
            } else if (action.startsWith("start_subject_quiz_")) {
                const subject = action.replace("start_subject_quiz_", "");
                startSubjectQuiz(subject);
            } else if (action.startsWith("quiz_ans_")) {
                const answer = action.replace("quiz_ans_", "");
                handleQuizChoice(answer);
            } else if (action.startsWith("plan_")) {
                const parts = action.split("_");
                const careerKey = parts[1];
                const duration = parseInt(parts[2]);
                showChatbotPreparationPlan(careerKey, duration);
            }
        }, 500);
    }

    // ==========================================
    // OFFLINE CHATBOT LOGIC
    // ==========================================
    function handleOfflineResponse(text) {
        const q = text.toLowerCase().trim();

        if (['hi', 'hello', 'hey', 'greetings', 'hola', 'yo'].some(kw => q.startsWith(kw))) {
            sendBotMessage(`Hello there! Hope your study session is going well. How can I help you today?`, [
                { text: "🎯 Career Path Guide", action: "start_careers" },
                { text: "📝 Take a Quiz", action: "start_quiz" },
                { text: "💡 Explain DSA", action: "explain_dsa" },
                { text: "🛠️ Recommend Project", action: "explain_project" }
            ]);
            return;
        }

        if (q.includes("html")) {
            sendBotMessage(`**HTML (HyperText Markup Language)** is the base layout standard for all web pages.
            
*   **Key Concepts**: Elements, tags, attributes, semantic headers (<main>, <article>), structural forms, input validation.
*   **Study Resource**: Check out our dedicated [HTML Study Guide](HTML.html)!
*   **Aura Tip**: Learn semantic HTML early; it makes SEO and accessibility optimization much easier!`, [
                { text: "📝 Take HTML Quiz", action: "start_subject_quiz_html" },
                { text: "🛠️ HTML Project Idea", action: "explain_project" }
            ]);
            return;
        }

        if (q.includes("css")) {
            sendBotMessage(`**CSS (Cascading Style Sheets)** styles and positions elements on your website.
            
*   **Key Concepts**: Selectors, Box Model, Flexbox, CSS Grid, Transitions, Media Queries.
*   **Study Resource**: Read the [CSS Study Guide](CSS.html).
*   **Aura Tip**: Master Flexbox and Grid first before jumping into tailwind or frameworks. It makes responsive layouts simple!`, [
                { text: "📝 Take CSS Quiz", action: "start_subject_quiz_css" }
            ]);
            return;
        }

        if (q.includes("javascript") || q === "js") {
            sendBotMessage(`**JavaScript (JS)** adds program logic and interactive controls to static web pages.
            
*   **Key Concepts**: Variables, Arrow Functions, Arrays & Objects, DOM Manipulation, Async Fetch, Event Listeners.
*   **Study Resource**: Master JS with the [JavaScript Study Guide](JavaScript.html).
*   **Aura Tip**: Understand Promises and async/await thoroughly, as they are crucial for API integrations!`, [
                { text: "📝 Take JS Quiz", action: "start_subject_quiz_js" }
            ]);
            return;
        }

        if (q.includes("dsa") || q.includes("algorithm") || q.includes("data structure")) {
            explainDSABasics();
            return;
        }

        if (q.includes("python")) {
            sendBotMessage(`**Python** is a highly versatile, readable general-purpose language popular in Data Science, AI, and scripting.
            
*   **Key Concepts**: Syntaxes, Lists & Dicts, Functions, Pandas/NumPy, Flask/Django APIs, File streams.
*   **Study Resource**: Read the [Python Study Guide](Python.html).`, [
                { text: "📝 Take Python Quiz", action: "start_subject_quiz_python" }
            ]);
            return;
        }

        if (q.includes("java")) {
            sendBotMessage(`**Java** is a robust, object-oriented language widely used for enterprise backend applications and Android development.
            
*   **Key Concepts**: Class Structures, Interfaces, Inheritance, Collections Framework, Spring Boot APIs.
*   **Study Resource**: Check out the [Java Study Guide](Java.html).`);
            return;
        }

        if (q.includes("sql") || q.includes("database") || q.includes("postgres") || q.includes("dbms")) {
            sendBotMessage(`**Database Systems (SQL / DBMS)** store, manage, and query structured data.
            
*   **Key Concepts**: Relational Tables, Select/Where Queries, INNER/LEFT Joins, Group By/Having, Indexing, Transactions.
*   **Study Guides**: Read the [SQL Guide](SQL.html), [PostgreSQL Guide](PostgreSQL.html), or [DBMS Guide](DBMS.html).`, [
                { text: "📝 Take SQL Quiz", action: "start_subject_quiz_sql" }
            ]);
            return;
        }

        if (q.includes("c ") || q === "c" || q.includes("pointers")) {
            sendBotMessage(`**C Language** is a low-level programming language providing direct memory control via pointers.
            
*   **Key Concepts**: Variable scopes, Pointer addresses (* and &), dynamic allocation (malloc/free), Structs, file I/O.
*   **Study Resource**: Check out our [C Study Guide](C.html).`, [
                { text: "📝 Take C Quiz", action: "start_subject_quiz_c" }
            ]);
            return;
        }

        if (q.includes("career") || q.includes("jobs") || q.includes("guidelines")) {
            startCareerGuide();
            return;
        }

        if (q.includes("project") || q.includes("ideas")) {
            explainProjectIdeas();
            return;
        }

        if (q.includes("quiz")) {
            startQuiz();
            return;
        }

        sendBotMessage(`I am running in **Offline Mode** (Aura Study Companion). I can answer questions about languages, host quizzes, and guide your studies.
        
To ask **any other type of question** (like writing custom code, debugging errors, general history, math assistance, etc.), open the **Settings gear icon** on top right and paste your free Gemini API Key!`);
    }

    // 1. Careers Flow
    function startCareerGuide() {
        const text = `Which Career specialty track would you like to explore? I can summarize description, prerequisites, and guidelines:`;
        sendBotMessage(text, [
            { text: "💻 Frontend", action: "select_career_frontend" },
            { text: "🖥️ Backend", action: "select_career_backend" },
            { text: "📊 Data Science", action: "select_career_datascience" },
            { text: "🛡️ Cybersecurity", action: "select_career_cybersecurity" }
        ]);
    }

    function showSpecificCareerGuide(key) {
        const info = CAREER_GUIDE[key];
        if (!info) {
            sendBotMessage("Sorry, I don't have detailed offline guidelines for that specific role yet.");
            return;
        }

        const response = `### 🎯 Career Guide: **${info.title}**

*   **Role Description**: ${info.desc}
*   **🔑 Key Prerequisites**: ${info.prereqs}
*   **🚀 Next Steps**: Open our [Reference Table](${info.link}) and select **${info.title}** in the Career dropdown on top to filter direct resources!

Choose a target duration below to generate a detailed preparation timeline:`;
        
        sendBotMessage(response, [
            { text: "📅 3-Month Fast Plan", action: `plan_${key}_3` },
            { text: "📅 6-Month Std Plan", action: `plan_${key}_6` },
            { text: "📅 12-Month Gradual Plan", action: `plan_${key}_12` },
            { text: "🔙 Other Careers", action: "start_careers" }
        ]);
    }

    // Render Career preparation plan inside chatbot
    function showChatbotPreparationPlan(careerKey, duration) {
        const info = CAREER_GUIDE[careerKey];
        if (!info) {
            sendBotMessage("Sorry, I don't have a structured schedule for that career path yet.");
            return;
        }

        const planText = PLAN_DETAILS[careerKey]?.[duration] || "Plan detail not found.";
        const prettyDuration = duration === 3 ? "3-Month Fast Track" : duration === 6 ? "6-Month Standard Track" : "12-Month Balanced Track";

        const response = `### 📅 ${prettyDuration} Study Plan: **${info.title}**

${planText}

*Aura Tip: Consistent daily study is far more effective than cramming. Track your progress with the checkboxes in the Study Guide pages!*`;

        sendBotMessage(response, [
            { text: "⏳ Change Duration", action: `select_career_${careerKey}` },
            { text: "🔙 Other Careers", action: "start_careers" }
        ]);
    }

    // 2. Quiz Subject Selection
    function startQuiz() {
        quizState.active = false;

        const text = `Which subject would you like to be quizzed on? I will choose 3 random questions from my database so they don't repeat:`;
        
        sendBotMessage(text, [
            { text: "🌐 HTML", action: "start_subject_quiz_html" },
            { text: "🎨 CSS", action: "start_subject_quiz_css" },
            { text: "⚡ JavaScript", action: "start_subject_quiz_js" },
            { text: "🐍 Python", action: "start_subject_quiz_python" },
            { text: "🗄️ SQL", action: "start_subject_quiz_sql" },
            { text: "🎯 C Pointers", action: "start_subject_quiz_c" },
            { text: "💡 DSA", action: "start_subject_quiz_dsa" }
        ]);
    }

    // Initialize the quiz with a specific subject
    function startSubjectQuiz(subject) {
        const bank = QUIZ_BANKS[subject];
        if (!bank || bank.length === 0) {
            sendBotMessage("Sorry, I don't have a quiz bank for that subject yet.");
            return;
        }

        const shuffled = shuffleArray(bank);
        
        quizState.active = true;
        quizState.subject = subject;
        quizState.questions = shuffled.slice(0, 3); // Draw 3 random questions
        quizState.questionIndex = 0;
        quizState.score = 0;

        const prettyNames = {
            html: "HTML Basics",
            css: "CSS Layouts",
            js: "JavaScript Programming",
            python: "Python Scripting",
            sql: "SQL Database Queries",
            c: "C Pointers & Memory",
            dsa: "Data Structures & Algorithms"
        };

        sendBotMessage(`Starting the **${prettyNames[subject]}** quiz! 📝 Let's test your knowledge.`);
        setTimeout(presentQuizQuestion, 800);
    }

    function presentQuizQuestion() {
        if (quizState.questionIndex >= quizState.questions.length) {
            finishQuiz();
            return;
        }

        const currentQ = quizState.questions[quizState.questionIndex];
        const text = `**Question ${quizState.questionIndex + 1}/${quizState.questions.length}:**\n${currentQ.q}`;
        
        const chips = Object.keys(currentQ.options).map(key => {
            return {
                text: `${key}) ${currentQ.options[key]}`,
                action: `quiz_ans_${key}`
            };
        });

        sendBotMessage(text, chips);
    }

    // Answer evaluator
    function handleQuizChoice(answer) {
        const currentQ = quizState.questions[quizState.questionIndex];
        let response = "";
        
        if (answer === currentQ.correct) {
            quizState.score++;
            response = `🟢 **Correct!** Excellent job.\n\n*Explanation:* ${currentQ.exp}`;
        } else {
            response = `🔴 **Incorrect.** The correct answer was **${currentQ.correct}) ${currentQ.options[currentQ.correct]}**.\n\n*Explanation:* ${currentQ.exp}`;
        }

        sendBotMessage(response);
        quizState.questionIndex++;

        setTimeout(presentQuizQuestion, 2000);
    }

    function handleQuizTextAnswer(text) {
        const cleanAns = text.trim().toUpperCase();
        if (['A', 'B', 'C'].includes(cleanAns)) {
            handleQuizChoice(cleanAns);
        } else {
            sendBotMessage("Please select one of the options by clicking the chips or typing A, B, or C.");
        }
    }

    function finishQuiz() {
        quizState.active = false;
        const score = quizState.score;
        const total = quizState.questions.length;
        
        let message = `### 🏆 Quiz Complete!
        
You scored **${score}/${total}** on the **${quizState.subject.toUpperCase()}** quiz! `;

        if (score === total) {
            message += "Perfect score! You are mastering this subject! 🌟";
        } else if (score >= total / 2) {
            message += "Good effort! Review the subject guide checklists to patch up any gaps. 📚";
        } else {
            message += "Keep practicing! Repeating checkpoints is key to solid learning. 💪";
        }

        sendBotMessage(message, [
            { text: "🔁 Try Again", action: "start_quiz" },
            { text: "🎯 Career Path Guide", action: "start_careers" }
        ]);
    }

    // 3. Explain DSA
    function explainDSABasics() {
        const text = `### 💡 Data Structures & Algorithms (DSA) Basics
Data Structures are ways to organize data; Algorithms are instructions that process that data to solve a problem.

**ASCII Representation of Memory:**
\`\`\`
Array (Contiguous blocks):
[ 10 | 20 | 30 | 40 ]
  0    1    2    3

Linked List (Node pointers):
[10|*]--> [20|*]--> [30|null]
\`\`\`

*   **Key Structures**: Arrays, Linked Lists, Stacks, Queues, Binary Trees, Hash Tables.
*   **Key Algorithms**: Binary Search, Bubble Sort, Merge Sort, Recursion, DFS & BFS Tree Traversals.
*   **Guide Link**: Read our local [DSA Study Guide](DSA.html) to practice step-by-step!`;

        sendBotMessage(text, [
            { text: "📝 Take DSA Quiz", action: "start_subject_quiz_dsa" }
        ]);
    }

    // 4. Explain Project Ideas
    function explainProjectIdeas() {
        const text = `### 🛠️ Portfolio Project Recommendations
Here are three student-friendly project ideas:

1.  **Frontend: Personal Interactive Dashboard**
    *   *Features*: Clock, local weather fetch, editable notepad task board, saved links. Uses HTML, CSS Grid, and JS local storage.
2.  **Backend: Student Attendance & Task REST API**
    *   *Features*: CRUD endpoints for students, checklist updates saved to MySQL/Postgres database. Uses Node.js/Python, Express/Flask.
3.  **Full Stack: Collaborative Study Room Planner**
    *   *Features*: Real-time message board, study status tracking checklist shared by user slots. Uses React, Socket.io, Node.js.`;

        sendBotMessage(text, [
            { text: "🎯 Career Tracks", action: "start_careers" }
        ]);
    }


    // ==========================================
    // GEMINI ONLINE API INTEGRATION (WITH CONVERSATION HISTORY MEMORY)
    // ==========================================
    async function queryGemini(userMessage) {
        const apiKey = config.apiKey;
        if (!apiKey) {
            sendBotMessage("It looks like the Gemini API Key is missing. Falling back to offline mode. Please configure the key in the settings gear icon.");
            config.mode = 'offline';
            safeStorage.setItem('aura_mode', 'offline');
            applySettingsUI();
            return;
        }

        chatHistory.push({
            role: "user",
            parts: [{ text: userMessage }]
        });

        if (chatHistory.length > 20) {
            chatHistory = chatHistory.slice(-20);
        }

        const systemInstruction = {
            parts: [{
                text: `You are Aura, an engaging, encouraging, and highly intelligent AI study tutor. 
Your goal is to answer ANY type of question the student asks—whether it is a conceptual question, code debugging, general science, writing advice, math tutoring, or mock interview questions.
Be supportive, clear, and structured. Use bullet points and markdown tables where appropriate.
If the student asks you to write code, provide clean, commented snippets in code blocks.
Frame educational suggestions around standard roadmap learning pathways. Refer students to check references.html and local guides (HTML.html, CSS.html, DSA.html, SQL.html) when relevant to their query.
Student's name: ${config.userName}.`
            }]
        };

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: chatHistory,
                    systemInstruction: systemInstruction
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const botResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (botResponseText) {
                chatHistory.push({
                    role: "model",
                    parts: [{ text: botResponseText }]
                });
                
                sendBotMessage(botResponseText);
            } else {
                throw new Error("Invalid response format from Gemini API");
            }

        } catch (error) {
            console.error("Gemini API Error:", error);
            
            chatHistory.pop();

            sendBotMessage(`🔴 **Aura Connection Error:** ${error.message}
            
Please make sure your API key is correct and you have an active network connection, or switch back to **Offline Mode** in the settings.`);
        }
    }


    // 3. Inject Chatbot into page on script load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }

})();
