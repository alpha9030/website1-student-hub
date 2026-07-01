/**
 * StudentHub AI Academic Success Agent (named Aura)
 * Acts as an autonomous context-aware educational counselor.
 * Connects to Gemini and synchronizes with SQLite backend settings, chats, profiles, and interactive quizzes.
 */

(function() {
    let chatMemory = [];
    let isTyping = false;
    let studentProfile = {
        name: 'Student',
        email: '',
        dept: '',
        grade: '',
        isLoggedIn: false
    };
    
    // Configured Success Profile fields
    let successProfile = {
        dept: 'cse',
        grade: '1',
        interests: '',
        marks: '',
        goals: '',
        weak_subjects: '',
        target_goals: '',
        exam_rank: '',
        state: '',
        category: 'General',
        exam_date: '',
        exam_subjects: '',
        study_hours: ''
    };

    // Practice Quiz State Tracker
    let quizState = {
        active: false,
        subject: '',
        questions: [],
        questionIndex: 0,
        score: 0
    };

    // Quiz Banks ported from Aura AI Tutor
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
                exp: "The z-index property specifies the stack order of elements along the 3D depth Z-axis."
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
                exp: "In JavaScript, typeof null returns 'object'. This is a legacy quirk of the language design."
            },
            {
                q: "Which function converts a string representation of a number to an integer?",
                options: { A: "parseInt()", B: "Number.cast()", C: "toInteger()" },
                correct: "A",
                exp: "The global parseInt() function parses a string argument and returns an integer of the specified radix."
            },
            {
                q: "Which keyword declares a block-scoped local variable?",
                options: { A: "let", B: "var", C: "const" },
                correct: "A",
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

    window.addEventListener('DOMContentLoaded', () => {
        initMentor();
    });

    const originalShowView = window.showView;
    window.showView = function(viewId) {
        if (originalShowView) originalShowView(viewId);
        if (viewId === 'mentor') {
            loadStudentProfile();
        }
    };

    function initMentor() {
        loadStudentProfile();
        
        const currentHash = window.location.hash.replace('#', '');
        if (currentHash === 'mentor' || (document.getElementById('mentor-panel') && document.getElementById('mentor-panel').classList.contains('active'))) {
            loadChatHistory();
            loadSavedPlans();
            loadSuccessProfile();
        }

        window.addEventListener('storage', (e) => {
            if (e.key === 'aura_api_key') {
                checkApiKeyStatus();
            }
        });
    }

    function loadStudentProfile() {
        const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
        studentProfile.isLoggedIn = loggedIn;
        if (loggedIn) {
            studentProfile.name = localStorage.getItem('studentName') || 'Student';
            studentProfile.email = localStorage.getItem('studentEmail') || '';
            studentProfile.dept = localStorage.getItem('studentDept') || '';
            studentProfile.grade = localStorage.getItem('studentGrade') || '';
            
            syncApiKeyFromBackend();
            loadSuccessProfile();
        } else {
            studentProfile.name = 'Guest';
            studentProfile.email = '';
            studentProfile.dept = '';
            studentProfile.grade = '';
            loadSuccessProfileLocal();
        }
        checkApiKeyStatus();
        loadChatHistory();
        loadSavedPlans();
    }

    async function syncApiKeyFromBackend() {
        if (!studentProfile.email) return;
        try {
            const resp = await fetch(`/api/chatbot?email=${encodeURIComponent(studentProfile.email)}`);
            const data = await resp.json();
            if (data.success && data.settings && data.settings.aura_api_key) {
                const currentKey = localStorage.getItem('aura_api_key');
                if (!currentKey || currentKey !== data.settings.aura_api_key) {
                    localStorage.setItem('aura_api_key', data.settings.aura_api_key);
                    checkApiKeyStatus();
                }
            }
        } catch (e) {
            console.warn("Could not sync API key:", e);
        }
    }

    // Switch Tabs inside Workspace
    window.switchMentorTab = function(tabId) {
        const buttons = document.querySelectorAll('.mentor-tab-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        
        const activeBtn = document.getElementById('tab-btn-' + tabId);
        if (activeBtn) activeBtn.classList.add('active');

        const contents = document.querySelectorAll('.mentor-tab-content');
        contents.forEach(cnt => cnt.classList.remove('active'));
        
        const activeContent = document.getElementById('mentor-tab-' + tabId);
        if (activeContent) activeContent.classList.add('active');

        if (tabId === 'dashboard') {
            updateConsistency();
            updateDashboardStrengthsWeaknesses();
        }
    };

    // Load Success Profile
    async function loadSuccessProfile() {
        if (studentProfile.isLoggedIn && studentProfile.email) {
            try {
                const resp = await fetch(`/api/mentor/profile?email=${encodeURIComponent(studentProfile.email)}`);
                const data = await resp.json();
                if (data.success && data.profile) {
                    successProfile = data.profile;
                    populateProfileFields();
                    updateConsistency();
                    updateDashboardStrengthsWeaknesses();
                    return;
                }
            } catch (e) {
                console.warn("Failed to load profile from database:", e);
            }
        }
        loadSuccessProfileLocal();
    }

    function loadSuccessProfileLocal() {
        const suffix = studentProfile.email ? '_' + studentProfile.email.replace(/[^a-zA-Z0-9]/g, '') : '_guest';
        
        successProfile = {
            dept: localStorage.getItem('mentor_branch' + suffix) || studentProfile.dept || 'cse',
            grade: localStorage.getItem('mentor_grade' + suffix) || '1',
            interests: localStorage.getItem('mentor_interests' + suffix) || '',
            marks: localStorage.getItem('mentor_marks' + suffix) || '',
            goals: localStorage.getItem('mentor_goals' + suffix) || '',
            weak_subjects: localStorage.getItem('mentor_weak_subjects' + suffix) || '',
            target_goals: localStorage.getItem('mentor_target_goals' + suffix) || '',
            exam_rank: localStorage.getItem('mentor_exam_rank' + suffix) || '',
            state: localStorage.getItem('mentor_state' + suffix) || '',
            category: localStorage.getItem('mentor_category' + suffix) || 'General',
            exam_date: localStorage.getItem('mentor_exam_date' + suffix) || '',
            exam_subjects: localStorage.getItem('mentor_exam_subjects' + suffix) || '',
            study_hours: localStorage.getItem('mentor_study_hours' + suffix) || ''
        };
        
        populateProfileFields();
        updateConsistency();
        updateDashboardStrengthsWeaknesses();
    }

    function populateProfileFields() {
        document.getElementById('profile-academic-branch').value = successProfile.dept || 'cse';
        document.getElementById('profile-academic-year').value = successProfile.grade || '1';
        document.getElementById('profile-academic-cgpa').value = successProfile.marks || '';
        document.getElementById('profile-academic-interests').value = successProfile.interests || '';
        document.getElementById('profile-academic-goals').value = successProfile.goals || '';
        document.getElementById('profile-academic-weak').value = successProfile.weak_subjects || '';
        document.getElementById('profile-academic-career').value = successProfile.target_goals || '';
        document.getElementById('profile-academic-companies').value = successProfile.target_goals || ''; 

        // Predictor fields
        document.getElementById('profile-pred-rank').value = successProfile.exam_rank || '';
        document.getElementById('profile-pred-branch').value = successProfile.dept || 'cse';
        document.getElementById('profile-pred-state').value = successProfile.state || '';
        document.getElementById('profile-pred-category').value = successProfile.category || 'General';

        // Planner fields
        document.getElementById('profile-plan-date').value = successProfile.exam_date || '';
        document.getElementById('profile-plan-subjects').value = successProfile.exam_subjects || '';
        document.getElementById('profile-plan-hours').value = successProfile.study_hours || '';
    }

    // Save success profile
    window.saveStudentMentorProfile = async function() {
        const branch = document.getElementById('profile-academic-branch').value;
        const year = document.getElementById('profile-academic-year').value;
        const marks = document.getElementById('profile-academic-cgpa').value.trim();
        const interests = document.getElementById('profile-academic-interests').value.trim();
        const goals = document.getElementById('profile-academic-goals').value.trim();
        const weakSubjects = document.getElementById('profile-academic-weak').value.trim();
        const targetGoals = document.getElementById('profile-academic-career').value.trim();
        
        // Predictor
        const rank = document.getElementById('profile-pred-rank').value;
        const state = document.getElementById('profile-pred-state').value.trim();
        const category = document.getElementById('profile-pred-category').value;
        
        // Planner
        const examDate = document.getElementById('profile-plan-date').value;
        const planSubjects = document.getElementById('profile-plan-subjects').value.trim();
        const planHours = document.getElementById('profile-plan-hours').value;

        successProfile = {
            dept: branch,
            grade: year,
            interests: interests,
            marks: marks,
            goals: goals,
            weak_subjects: weakSubjects,
            target_goals: targetGoals,
            exam_rank: rank,
            state: state,
            category: category,
            exam_date: examDate,
            exam_subjects: planSubjects,
            study_hours: planHours
        };

        const suffix = studentProfile.email ? '_' + studentProfile.email.replace(/[^a-zA-Z0-9]/g, '') : '_guest';

        // Save local
        localStorage.setItem('mentor_branch' + suffix, branch);
        localStorage.setItem('mentor_grade' + suffix, year);
        localStorage.setItem('mentor_marks' + suffix, marks);
        localStorage.setItem('mentor_interests' + suffix, interests);
        localStorage.setItem('mentor_goals' + suffix, goals);
        localStorage.setItem('mentor_weak_subjects' + suffix, weakSubjects);
        localStorage.setItem('mentor_target_goals' + suffix, targetGoals);
        localStorage.setItem('mentor_exam_rank' + suffix, rank);
        localStorage.setItem('mentor_state' + suffix, state);
        localStorage.setItem('mentor_category' + suffix, category);
        localStorage.setItem('mentor_exam_date' + suffix, examDate);
        localStorage.setItem('mentor_exam_subjects' + suffix, planSubjects);
        localStorage.setItem('mentor_study_hours' + suffix, planHours);

        // Sync to DB
        if (studentProfile.isLoggedIn && studentProfile.email) {
            try {
                const resp = await fetch('/api/mentor/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: studentProfile.email,
                        dept: branch,
                        grade: year,
                        interests: interests,
                        marks: marks,
                        goals: goals,
                        weak_subjects: weakSubjects,
                        target_goals: targetGoals,
                        exam_rank: rank,
                        state: state,
                        category: category,
                        exam_date: examDate,
                        exam_subjects: planSubjects,
                        study_hours: planHours
                    })
                });
                const res = await resp.json();
                if (res.success) {
                    document.getElementById('chk-prof-complete').checked = true;
                    alert("Aura success configurations saved & synchronized successfully!");
                } else {
                    alert("Profile saved locally (database sync failed: " + res.message + ")");
                }
            } catch (e) {
                console.warn("Could not sync profile to backend:", e);
                alert("Profile saved locally (database connection failed).");
            }
        } else {
            document.getElementById('chk-prof-complete').checked = true;
            alert("Success Profile saved locally!");
        }

        updateConsistency();
        updateDashboardStrengthsWeaknesses();
    };

    // Calculate Consistency & Readiness scores
    window.updateConsistency = function() {
        let completenessPoints = 0;
        let totalCompleteness = 6;
        
        if (successProfile.interests) completenessPoints++;
        if (successProfile.marks) completenessPoints++;
        if (successProfile.goals) completenessPoints++;
        if (successProfile.weak_subjects) completenessPoints++;
        if (successProfile.target_goals) completenessPoints++;
        if (successProfile.exam_date) completenessPoints++;

        let checklistPoints = 0;
        let totalChecklist = 3;
        if (document.getElementById('chk-prof-complete') && document.getElementById('chk-prof-complete').checked) checklistPoints++;
        if (document.getElementById('chk-gkey') && document.getElementById('chk-gkey').checked) checklistPoints++;
        if (document.getElementById('chk-study-plan') && document.getElementById('chk-study-plan').checked) checklistPoints++;

        // Consistency score
        const consistencyVal = Math.round(((completenessPoints + checklistPoints) / (totalCompleteness + totalChecklist)) * 100);
        const consistencyText = document.getElementById('agent-consistency-text');
        const consistencyBar = document.getElementById('agent-consistency-bar');
        if (consistencyText) consistencyText.textContent = consistencyVal + '%';
        if (consistencyBar) consistencyBar.style.width = consistencyVal + '%';

        // Career readiness
        let readinessVal = 0;
        if (successProfile.marks) {
            const marksNum = parseFloat(successProfile.marks);
            if (!isNaN(marksNum)) {
                if (marksNum >= 9.0 || marksNum >= 90) readinessVal += 40;
                else if (marksNum >= 8.0 || marksNum >= 80) readinessVal += 35;
                else if (marksNum >= 7.0 || marksNum >= 70) readinessVal += 30;
                else readinessVal += 20;
            } else {
                readinessVal += 25;
            }
        }
        if (successProfile.interests && successProfile.interests.length > 5) readinessVal += 20;
        if (successProfile.target_goals && successProfile.target_goals.length > 5) readinessVal += 20;
        if (checklistPoints === totalChecklist) readinessVal += 20;

        const readinessText = document.getElementById('agent-readiness-text');
        const readinessBar = document.getElementById('agent-readiness-bar');
        if (readinessText) readinessText.textContent = readinessVal + '%';
        if (readinessBar) readinessBar.style.width = readinessVal + '%';
    };

    function updateDashboardStrengthsWeaknesses() {
        const strengthsList = document.getElementById('dashboard-strengths-list');
        const weakList = document.getElementById('dashboard-weaknesses-list');
        if (!strengthsList || !weakList) return;

        // Strengths
        if (successProfile.interests || successProfile.marks) {
            let strengthsHTML = '<ul style="margin: 0; padding-left: 20px;">';
            if (successProfile.marks) {
                strengthsHTML += `<li><strong>Academic Standing:</strong> Current score of ${successProfile.marks}.</li>`;
            }
            if (successProfile.interests) {
                strengthsHTML += `<li><strong>Technical Alignment:</strong> Core focus in ${successProfile.interests}.</li>`;
            }
            strengthsHTML += `<li><strong>Curriculum Sync:</strong> Specializing in ${successProfile.dept.toUpperCase()} (Year ${successProfile.grade}).</li>`;
            strengthsHTML += '</ul>';
            strengthsList.innerHTML = strengthsHTML;
        } else {
            strengthsList.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; margin: 0;">Save profile details to let Aura analyze your strengths.</p>';
        }

        // Weaknesses
        if (successProfile.weak_subjects) {
            let weakHTML = '<ul style="margin: 0; padding-left: 20px;">';
            const topics = successProfile.weak_subjects.split(',');
            topics.forEach(topic => {
                weakHTML += `<li>Requires concept strengthening and extra practice in <strong>${topic.trim()}</strong>.</li>`;
            });
            weakHTML += '</ul>';
            weakList.innerHTML = weakHTML;
        } else {
            weakList.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; margin: 0;">Save profile details to let Aura analyze your weaknesses.</p>';
        }
    }

    // Check API Key
    function checkApiKeyStatus() {
        const key = localStorage.getItem('aura_api_key') || '';
        const banner = document.getElementById('mentor-api-banner');
        const chatInput = document.getElementById('mentor-chat-input');
        const sendBtn = document.querySelector('.mentor-send-btn');
        const quickBtns = document.querySelectorAll('.quick-action-btn');
        const gkeyCheck = document.getElementById('chk-gkey');

        if (!key) {
            if (banner) banner.style.display = 'flex';
            if (chatInput) chatInput.disabled = true;
            if (sendBtn) sendBtn.disabled = true;
            quickBtns.forEach(btn => btn.disabled = true);
            if (gkeyCheck) gkeyCheck.checked = false;
        } else {
            if (banner) banner.style.display = 'none';
            if (chatInput) chatInput.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            quickBtns.forEach(btn => btn.disabled = false);
            if (gkeyCheck) gkeyCheck.checked = true;
        }
        updateConsistency();
    }

    window.openMentorKeyModal = function() {
        const modal = document.getElementById('mentor-key-modal');
        document.getElementById('mentor-key-input').value = localStorage.getItem('aura_api_key') || '';
        modal.classList.add('active');
    };

    window.closeMentorKeyModal = function() {
        document.getElementById('mentor-key-modal').classList.remove('active');
    };

    window.saveMentorKey = function() {
        const keyInput = document.getElementById('mentor-key-input').value.trim();
        if (!keyInput) {
            alert("Please enter a valid Gemini API Key!");
            return;
        }

        localStorage.setItem('aura_api_key', keyInput);
        if (studentProfile.isLoggedIn && studentProfile.email) {
            const userName = studentProfile.name;
            fetch('/api/chatbot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: studentProfile.email,
                    aura_mode: 'gemini',
                    aura_api_key: keyInput,
                    aura_user_name: userName
                })
            }).catch(err => console.warn("Failed to sync key to backend:", err));
        }

        checkApiKeyStatus();
closeMentorKeyModal();
        alert("API Key saved successfully!");
        if (chatMemory.length === 0) {
            loadChatHistory();
        }
    };

    // Conversation history sidebar state
    let conversations = [];
    let folders = [];
    let activeConversationId = 'default_academic';
    let attachedFiles = [];
    let autoTTS = false;
    let recognition = null;
    let isRecording = false;
    let lastWikiContext = "";

    // Expose functions to window object
    window.toggleAuraSidebar = function() {
        const sidebar = document.getElementById('aura-sidebar');
        if (sidebar) sidebar.classList.toggle('open');
    };

    window.createNewConversation = function(title = 'New Chat', folder = null) {
        const id = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const newChat = {
            id: id,
            title: title,
            messages: [],
            pinned: false,
            folder: folder,
            timestamp: new Date().toISOString()
        };
        conversations.unshift(newChat);
        saveFoldersAndConversations();
        selectConversation(id);
    };

    window.createNewFolder = function() {
        const name = prompt("Enter new folder name:");
        if (!name || !name.trim()) return;
        const trimmed = name.trim();
        if (folders.includes(trimmed)) {
            alert("Folder already exists!");
            return;
        }
        folders.push(trimmed);
        saveFoldersAndConversations();
        renderConversationsSidebar();
    };

    window.selectConversation = function(id) {
        activeConversationId = id;
        renderConversationsSidebar();
        renderActiveConversationMessages();
    };

    window.renameConversation = function(id) {
        const chat = conversations.find(c => c.id === id);
        if (!chat) return;
        const newTitle = prompt("Rename conversation:", chat.title);
        if (!newTitle || !newTitle.trim()) return;
        chat.title = newTitle.trim();
        saveFoldersAndConversations();
        renderConversationsSidebar();
    };

    window.togglePinConversation = function(id) {
        const chat = conversations.find(c => c.id === id);
        if (!chat) return;
        chat.pinned = !chat.pinned;
        saveFoldersAndConversations();
        renderConversationsSidebar();
    };

    window.deleteConversation = function(id) {
        if (id === 'default_academic') return;
        if (confirm("Delete this conversation?")) {
            conversations = conversations.filter(c => c.id !== id);
            if (activeConversationId === id) {
                activeConversationId = 'default_academic';
            }
            saveFoldersAndConversations();
            loadChatHistory();
        }
    };

    window.deleteFolder = function(fName, e) {
        if (e) e.stopPropagation();
        if (confirm(`Delete folder "${fName}"? Chats inside will be moved out.`)) {
            folders = folders.filter(f => f !== fName);
            conversations.forEach(c => {
                if (c.folder === fName) c.folder = null;
            });
            saveFoldersAndConversations();
            renderConversationsSidebar();
        }
    };

    window.toggleAutoTTS = function() {
        autoTTS = !autoTTS;
        const btn = document.getElementById('aura-tts-toggle-btn');
        if (btn) {
            btn.innerHTML = autoTTS ? '🔊 TTS' : '🔇 TTS';
            btn.title = autoTTS ? 'Auto Read Aloud (Enabled)' : 'Auto Read Aloud (Disabled)';
            if (autoTTS) {
                btn.style.background = 'var(--primary-color)';
                btn.style.color = 'white';
            } else {
                btn.style.background = '';
                btn.style.color = '';
            }
        }
    };

    window.toggleAuraVoiceDictation = function() {
        const btn = document.getElementById('aura-dictate-btn');
        if (!btn) return;
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }
        
        if (isRecording) {
            recognition.stop();
            return;
        }
        
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onstart = function() {
            isRecording = true;
            btn.classList.add('active');
            btn.title = "Stop recording";
            document.getElementById('mentor-chat-input').placeholder = "Listening... Speak now.";
        };
        
        recognition.onerror = function() {
            stopVoiceRecording();
        };
        
        recognition.onend = function() {
            stopVoiceRecording();
        };
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            const input = document.getElementById('mentor-chat-input');
            if (input && transcript) {
                input.value = (input.value.trim() + " " + transcript).trim();
            }
        };
        
        recognition.start();
    };

    window.triggerAuraFileUpload = function() {
        const fileInput = document.getElementById('aura-file-upload-input');
        if (fileInput) fileInput.click();
    };

    window.handleAuraFilesSelected = function(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        
        const statusSpan = document.getElementById('aura-upload-status');
        if (statusSpan) statusSpan.textContent = `Attached ${files.length} file(s)`;
        
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            if (file.type.startsWith('image/')) {
                reader.readAsDataURL(file);
                reader.onload = function(e) {
                    attachedFiles.push({ name: file.name, type: file.type, data: e.target.result });
                    renderAttachmentPills();
                };
            } else {
                reader.readAsText(file);
                reader.onload = function(e) {
                    attachedFiles.push({ name: file.name, type: file.type, data: e.target.result });
                    renderAttachmentPills();
                };
            }
        });
        
        if (statusSpan) setTimeout(() => statusSpan.textContent = '', 2000);
    };

    window.removeAttachedFile = function(index) {
        attachedFiles.splice(index, 1);
        renderAttachmentPills();
    };

    window.clearActiveConversation = async function() {
        if (confirm("Clear this conversation history?")) {
            const activeChat = conversations.find(c => c.id === activeConversationId);
            if (!activeChat) return;
            
            activeChat.messages = [];
            document.getElementById('mentor-messages-container').innerHTML = '';
            saveFoldersAndConversations();
            
            if (activeConversationId === 'default_academic') {
                chatMemory = [];
                if (studentProfile.isLoggedIn && studentProfile.email) {
                    try {
                        await fetch(`/api/mentor/chats?email=${encodeURIComponent(studentProfile.email)}`, {
                            method: 'DELETE'
                        });
                    } catch(e) {
                        console.warn("Failed to clear chat history on server:", e);
                    }
                } else {
                    sessionStorage.removeItem('mentor_chat_history_guest');
                }
            }
            showInitialWelcome();
        }
    };

    window.exportCurrentConversation = function() {
        const activeChat = conversations.find(c => c.id === activeConversationId);
        if (!activeChat || activeChat.messages.length === 0) {
            alert("No messages to export!");
            return;
        }
        
        let mdContent = `# ✧ Aura AI Assistant Conversation ✧\n`;
        mdContent += `**Date:** ${new Date().toLocaleString()}\n`;
        mdContent += `**Chat:** ${activeChat.title}\n\n`;
        mdContent += `---\n\n`;
        
        activeChat.messages.forEach(msg => {
            const roleName = msg.role === 'user' ? 'User' : '✧ Aura';
            const textPart = msg.parts.find(p => p.text)?.text || '';
            mdContent += `### 👤 ${roleName}:\n${textPart}\n\n`;
        });
        
        const format = confirm("Click OK to save as PDF, or Cancel to copy as Markdown.");
        if (format) {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>✧ Aura Chat - ${activeChat.title} ✧</title>
                    <style>
                        body { font-family: 'Outfit', sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
                        h1 { color: #8b5cf6; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 30px; }
                        h3 { font-size: 16px; margin-top: 25px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; }
                        .user { color: #2563eb; }
                        .aura { color: #7c3aed; }
                        pre { background: #f1f5f9; padding: 12px; border-radius: 8px; font-family: monospace; overflow-x: auto; }
                        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
                        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
                        th { background-color: #f8fafc; }
                    </style>
                </head>
                <body>
                    <h1>✧ Aura Chat - ${activeChat.title} ✧</h1>
                    <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>
                    <hr>
            `);
            
            activeChat.messages.forEach(msg => {
                const roleName = msg.role === 'user' ? 'user' : 'aura';
                const label = msg.role === 'user' ? '👤 User' : '✧ Aura';
                const textPart = msg.parts.find(p => p.text)?.text || '';
                printWindow.document.write(`
                    <h3 class="${roleName}">${label}:</h3>
                    <div>${formatMarkdown(textPart)}</div>
                `);
            });
            
            printWindow.document.write(`</body></html>`);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        } else {
            navigator.clipboard.writeText(mdContent);
            alert("Markdown copied to clipboard!");
        }
    };

    // Load Chat History
    async function loadChatHistory() {
        const container = document.getElementById('mentor-messages-container');
        if (!container) return;
        container.innerHTML = '';
        chatMemory = [];

        const suffix = studentProfile.email || 'guest';
        const storageKey = 'aura_conversations_' + suffix;
        const foldersKey = 'aura_folders_' + suffix;
        
        try {
            conversations = JSON.parse(localStorage.getItem(storageKey) || '[]');
            folders = JSON.parse(localStorage.getItem(foldersKey) || '[]');
        } catch(e) {
            conversations = [];
            folders = [];
        }
        
        if (!Array.isArray(conversations)) conversations = [];
        if (!Array.isArray(folders)) folders = [];
        
        // Ensure default academic chat exists
        let defaultChat = conversations.find(c => c.id === 'default_academic');
        if (!defaultChat) {
            defaultChat = {
                id: 'default_academic',
                title: '🎓 Academic Assistant',
                messages: [],
                pinned: true,
                folder: null,
                timestamp: new Date().toISOString()
            };
            conversations.unshift(defaultChat);
            localStorage.setItem(storageKey, JSON.stringify(conversations));
        }
        
        if (!activeConversationId || !conversations.some(c => c.id === activeConversationId)) {
            activeConversationId = 'default_academic';
        }
        
        renderConversationsSidebar();
        renderActiveConversationMessages();
        setupDragAndDrop();
    }

    function showInitialWelcome() {
        const container = document.getElementById('mentor-messages-container');
        if (!container) return;
        container.innerHTML = '';
        
        const welcomeText = `👋 Hello **${studentProfile.name}**! I am **✧ Aura ✧**, your general-purpose **AI Assistant and Academic Counselor** ✨
        
I am here to assist you with:
* 📚 **Studies & Concept Explanations**
* 💻 **Coding & Debugging**
* 📅 **Custom Study Plans & Schedules**
* 📝 **Essay Writing, Translation, & Summarization**
* 🧠 **General Knowledge & Research**

📎 *You can upload files or images directly by dragging them here, dictating via voice input 🎤, or using tools like Web Search 🔍 and JavaScript Execution 💻.*

How can I help you today?`;

        appendMessageUI('bot', welcomeText, new Date(), false);
    }

    async function saveChatMessage(sender, message) {
        if (studentProfile.isLoggedIn && studentProfile.email) {
            try {
                await fetch('/api/mentor/chats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: studentProfile.email,
                        sender: sender,
                        message: message
                    })
                });
            } catch(e) {
                console.warn("Failed to save chat message:", e);
            }
        } else {
            sessionStorage.setItem('mentor_chat_history_guest', JSON.stringify(chatMemory));
        }
    }

    function appendMessageUI(sender, text, timestamp = new Date(), addControls = true) {
        const container = document.getElementById('mentor-messages-container');
        if (!container) return;
        
        hideTyping();
        
        const msgDiv = document.createElement('div');
        msgDiv.className = `mentor-message ${sender}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerHTML = formatMarkdown(text);
        
        msgDiv.appendChild(bubble);
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        msgDiv.appendChild(timeSpan);
        
        container.appendChild(msgDiv);
        if (addControls) {
            addMessageInteractionControls(msgDiv, sender, text);
        }
        scrollChatBottom();
    }

    function scrollChatBottom() {
        const container = document.getElementById('mentor-messages-container');
        if (container) container.scrollTop = container.scrollHeight;
    }

    window.handleMentorInputKey = function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMentorMessage();
        }
    };

    window.sendMentorMessage = async function() {
        const input = document.getElementById('mentor-chat-input');
        const text = input.value.trim();
        if (!text && attachedFiles.length === 0) return;
        if (isTyping) return;

        input.value = '';
        input.style.height = 'auto';
        
        let displayPrompt = text;
        if (attachedFiles.length > 0) {
            const fileListStr = attachedFiles.map(f => `[Attached file: ${f.name}]`).join(' ');
            displayPrompt = `${fileListStr} ${text}`.trim();
        }

        appendMessageUI('user', displayPrompt);
        
        const userPart = { text: text || "Uploaded file analysis request" };
        chatMemory.push({
            role: 'user',
            parts: [userPart]
        });
        
        updateActiveConversationHistory();

        if (activeConversationId === 'default_academic' && studentProfile.isLoggedIn) {
            await saveChatMessage('user', displayPrompt);
        }

        await callGeminiMentorAPI(text);
    };

    function showTyping() {
        if (isTyping) return;
        isTyping = true;
        
        const container = document.getElementById('mentor-messages-container');
        if (!container) return;
        const typingDiv = document.createElement('div');
        typingDiv.className = 'mentor-message bot typing-indicator-container';
        typingDiv.id = 'mentor-typing-indicator';
        
        const dots = document.createElement('div');
        dots.className = 'mentor-typing';
        dots.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        typingDiv.appendChild(dots);
        container.appendChild(typingDiv);
        scrollChatBottom();
    }

    function hideTyping() {
        isTyping = false;
        const typingDiv = document.getElementById('mentor-typing-indicator');
        if (typingDiv) {
            typingDiv.remove();
        }
    }

    function renderConversationsSidebar() {
        const listContainer = document.getElementById('aura-sessions-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        
        const searchQuery = (document.getElementById('aura-history-search')?.value || '').toLowerCase().trim();
        
        let filtered = conversations.filter(c => {
            if (!searchQuery) return true;
            if (c.title.toLowerCase().includes(searchQuery)) return true;
            return c.messages.some(m => m.parts.some(p => p.text && p.text.toLowerCase().includes(searchQuery)));
        });
        
        const pinnedChats = filtered.filter(c => c.pinned);
        const unpinnedChats = filtered.filter(c => !c.pinned);
        
        if (pinnedChats.length > 0) {
            const pinHeader = document.createElement('div');
            pinHeader.className = 'aura-folder-header';
            pinHeader.innerHTML = '📌 Pinned';
            listContainer.appendChild(pinHeader);
            pinnedChats.forEach(c => {
                listContainer.appendChild(createSidebarItemEl(c));
            });
        }
        
        folders.forEach(fName => {
            const folderChats = unpinnedChats.filter(c => c.folder === fName);
            const folderContainer = document.createElement('div');
            folderContainer.style.marginBottom = '6px';
            
            const folderHeader = document.createElement('div');
            folderHeader.className = 'aura-folder-header';
            folderHeader.innerHTML = `📁 ${fName} <span class="action-icon" onclick="deleteFolder('${fName}', event)">×</span>`;
            folderHeader.addEventListener('click', (e) => {
                if (e.target.className === 'action-icon') return;
                const body = folderContainer.querySelector('.aura-sidebar-folder');
                if (body) body.style.display = body.style.display === 'none' ? 'flex' : 'none';
            });
            folderContainer.appendChild(folderHeader);
            
            const folderBody = document.createElement('div');
            folderBody.className = 'aura-sidebar-folder';
            folderBody.style.display = 'flex';
            folderBody.style.flexDirection = 'column';
            folderBody.style.gap = '2px';
            
            folderBody.addEventListener('dragover', (e) => e.preventDefault());
            folderBody.addEventListener('drop', (e) => {
                e.preventDefault();
                const chatId = e.dataTransfer.getData('text/plain');
                const chat = conversations.find(c => c.id === chatId);
                if (chat) {
                    chat.folder = fName;
                    saveFoldersAndConversations();
                    renderConversationsSidebar();
                }
            });
            
            folderChats.forEach(c => {
                folderBody.appendChild(createSidebarItemEl(c));
            });
            
            if (folderChats.length === 0) {
                const empty = document.createElement('div');
                empty.style.padding = '4px 10px';
                empty.style.fontSize = '10.5px';
                empty.style.color = 'var(--text-muted)';
                empty.style.fontStyle = 'italic';
                empty.textContent = 'Drag chats here';
                folderBody.appendChild(empty);
            }
            
            folderContainer.appendChild(folderBody);
            listContainer.appendChild(folderContainer);
        });
        
        const remainingChats = unpinnedChats.filter(c => !c.folder);
        if (remainingChats.length > 0) {
            const chatsHeader = document.createElement('div');
            chatsHeader.className = 'aura-folder-header';
            chatsHeader.innerHTML = '💬 Conversations';
            listContainer.appendChild(chatsHeader);
            remainingChats.forEach(c => {
                listContainer.appendChild(createSidebarItemEl(c));
            });
        }
    }

    function createSidebarItemEl(c) {
        const item = document.createElement('div');
        item.className = `aura-sidebar-item ${c.id === activeConversationId ? 'active' : ''}`;
        
        item.draggable = true;
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', c.id);
        });
        
        const details = document.createElement('div');
        details.className = 'item-details';
        details.addEventListener('click', () => {
            selectConversation(c.id);
        });
        
        const symbol = c.id === 'default_academic' ? '🎓 ' : '💬 ';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'title-text';
        titleSpan.textContent = symbol + c.title;
        
        details.appendChild(titleSpan);
        item.appendChild(details);
        
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '4px';
        actions.style.alignItems = 'center';
        
        const pinBtn = document.createElement('span');
        pinBtn.className = 'action-icon';
        pinBtn.innerHTML = c.pinned ? '📌' : '📍';
        pinBtn.title = c.pinned ? 'Unpin' : 'Pin';
        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePinConversation(c.id);
        });
        actions.appendChild(pinBtn);
        
        const editBtn = document.createElement('span');
        editBtn.className = 'action-icon';
        editBtn.innerHTML = '✏️';
        editBtn.title = 'Rename';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            renameConversation(c.id);
        });
        actions.appendChild(editBtn);
        
        if (c.id !== 'default_academic') {
            const delBtn = document.createElement('span');
            delBtn.className = 'action-icon';
            delBtn.innerHTML = '🗑️';
            delBtn.title = 'Delete';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteConversation(c.id);
            });
            actions.appendChild(delBtn);
        }
        
        item.appendChild(actions);
        return item;
    }

    async function renderActiveConversationMessages() {
        const container = document.getElementById('mentor-messages-container');
        if (!container) return;
        container.innerHTML = '';
        
        const activeChat = conversations.find(c => c.id === activeConversationId);
        if (!activeChat) return;
        
        if (activeConversationId === 'default_academic' && studentProfile.isLoggedIn && activeChat.messages.length === 0) {
            showTyping();
            try {
                const resp = await fetch(`/api/mentor/chats?email=${encodeURIComponent(studentProfile.email)}`);
                const data = await resp.json();
                hideTyping();
                if (data.success && data.chats && data.chats.length > 0) {
                    activeChat.messages = [];
                    data.chats.forEach(chat => {
                        activeChat.messages.push({
                            role: chat.sender === 'user' ? 'user' : 'model',
                            parts: [{ text: chat.message }]
                        });
                    });
                    saveFoldersAndConversations();
                }
            } catch(e) {
                console.warn("Could not sync default chat from server:", e);
                hideTyping();
            }
        }
        
        chatMemory = activeChat.messages;
        
        if (chatMemory.length === 0) {
            showInitialWelcome();
        } else {
            chatMemory.forEach(msg => {
                const sender = msg.role === 'user' ? 'user' : 'bot';
                const textPart = msg.parts.find(p => p.text)?.text;
                if (textPart) {
                    appendMessageUI(sender, textPart, new Date(), true);
                } else if (msg.parts.some(p => p.functionCall)) {
                    const fc = msg.parts.find(p => p.functionCall).functionCall;
                    appendToolCallUI(fc.name, fc.args, true);
                }
            });
        }
        scrollChatBottom();
    }

    function addMessageInteractionControls(msgDiv, role, text) {
        const bubble = msgDiv.querySelector('.message-bubble');
        if (!bubble) return;
        
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'message-controls';
        controlsDiv.style.display = 'flex';
        controlsDiv.style.gap = '8px';
        controlsDiv.style.marginTop = '8px';
        controlsDiv.style.fontSize = '11px';
        controlsDiv.style.opacity = '0.65';
        
        if (role === 'bot' || role === 'model') {
            const speakBtn = document.createElement('span');
            speakBtn.style.cursor = 'pointer';
            speakBtn.innerHTML = '🔊 Speak';
            speakBtn.addEventListener('click', () => speakText(text));
            controlsDiv.appendChild(speakBtn);
            
            const copyBtn = document.createElement('span');
            copyBtn.style.cursor = 'pointer';
            copyBtn.innerHTML = '📋 Copy';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(text);
                copyBtn.innerHTML = '✅ Copied';
                setTimeout(() => copyBtn.innerHTML = '📋 Copy', 1500);
            });
            controlsDiv.appendChild(copyBtn);

            const shareBtn = document.createElement('span');
            shareBtn.style.cursor = 'pointer';
            shareBtn.innerHTML = '🔗 Share';
            shareBtn.addEventListener('click', () => {
                const md = getConversationMarkdown();
                navigator.clipboard.writeText(md);
                shareBtn.innerHTML = '✅ Link Copied';
                setTimeout(() => shareBtn.innerHTML = '🔗 Share', 1500);
            });
            controlsDiv.appendChild(shareBtn);
            
            const regenBtn = document.createElement('span');
            regenBtn.style.cursor = 'pointer';
            regenBtn.innerHTML = '🔄 Regenerate';
            regenBtn.addEventListener('click', () => regenerateResponse(msgDiv));
            controlsDiv.appendChild(regenBtn);

            if (text.toLowerCase().includes('study plan') || text.toLowerCase().includes('timetable') || text.includes('|')) {
                const saveBtn = document.createElement('span');
                saveBtn.style.cursor = 'pointer';
                saveBtn.style.fontWeight = 'bold';
                saveBtn.style.color = 'var(--primary-color)';
                saveBtn.innerHTML = '💾 Save Study Plan';
                saveBtn.addEventListener('click', () => saveGeneratedPlan(text));
                controlsDiv.appendChild(saveBtn);
            }
        } else {
            const editBtn = document.createElement('span');
            editBtn.style.cursor = 'pointer';
            editBtn.innerHTML = '✏️ Edit';
            editBtn.addEventListener('click', () => editUserMessage(msgDiv, text));
            controlsDiv.appendChild(editBtn);
        }
        bubble.appendChild(controlsDiv);
    }

    function getConversationMarkdown() {
        const activeChat = conversations.find(c => c.id === activeConversationId);
        if (!activeChat) return "";
        let md = `## ✧ Aura Conversation: ${activeChat.title} ✧\n\n`;
        activeChat.messages.forEach(msg => {
            const roleName = msg.role === 'user' ? 'User' : '✧ Aura';
            const txt = msg.parts.find(p => p.text)?.text || '';
            md += `**${roleName}**:\n${txt}\n\n`;
        });
        return md;
    }

    window.editUserMessage = function(msgDiv, text) {
        const input = document.getElementById('mentor-chat-input');
        if (input) {
            input.value = text;
            input.focus();
            const msgIndex = chatMemory.findIndex(m => m.role === 'user' && m.parts.some(p => p.text === text));
            if (msgIndex !== -1) {
                chatMemory.splice(msgIndex);
                updateActiveConversationHistory();
                renderActiveConversationMessages();
            }
        }
    };

    window.regenerateResponse = async function(msgDiv) {
        const textContent = chatMemory.find(m => m.role === 'model' && m.parts.some(p => p.text))?.parts.find(p => p.text)?.text;
        const msgIndex = chatMemory.findIndex(m => m.role === 'model' && m.parts.some(p => p.text && p.text === textContent));
        if (msgIndex !== -1) {
            chatMemory.splice(msgIndex);
            updateActiveConversationHistory();
            renderActiveConversationMessages();
            const lastUserMsg = chatMemory[chatMemory.length - 1];
            if (lastUserMsg && lastUserMsg.role === 'user') {
                const prompt = lastUserMsg.parts.find(p => p.text)?.text;
                if (prompt) await callGeminiMentorAPI(prompt);
            }
        }
    };

    function updateActiveConversationHistory() {
        const activeChat = conversations.find(c => c.id === activeConversationId);
        if (activeChat) {
            activeChat.messages = chatMemory;
            activeChat.timestamp = new Date().toISOString();
            saveFoldersAndConversations();
        }
    }

    function saveFoldersAndConversations() {
        const suffix = studentProfile.email || 'guest';
        localStorage.setItem('aura_conversations_' + suffix, JSON.stringify(conversations));
        localStorage.setItem('aura_folders_' + suffix, JSON.stringify(folders));
    }

    // Voice dictation utilities
    function stopVoiceRecording() {
        isRecording = false;
        const btn = document.getElementById('aura-dictate-btn');
        if (btn) {
            btn.classList.remove('active');
            btn.title = "Voice Input";
        }
        const input = document.getElementById('mentor-chat-input');
        if (input) {
            input.placeholder = "Ask anything, upload files/images, run Javascript, or use tools...";
        }
    }

    function speakText(text) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[*#`_\-|>\[\]()]/g, '').replace(/https?:\/\/\S+/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.lang.startsWith('en')) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        window.speechSynthesis.speak(utterance);
    }

    // Attachment view utilities
    function renderAttachmentPills() {
        const bar = document.getElementById('aura-attachment-preview-bar');
        const container = document.getElementById('aura-attachment-pills');
        if (!bar || !container) return;
        
        if (attachedFiles.length === 0) {
            bar.style.display = 'none';
            container.innerHTML = '';
            return;
        }
        
        bar.style.display = 'flex';
        container.innerHTML = '';
        attachedFiles.forEach((file, index) => {
            const pill = document.createElement('div');
            pill.className = 'aura-attachment-pill';
            const icon = file.type.startsWith('image/') ? '🖼️' : '📄';
            pill.innerHTML = `
                <span>${icon} ${file.name.slice(0, 15)}${file.name.length > 15 ? '...' : ''}</span>
                <span class="remove-btn" onclick="removeAttachedFile(${index})">×</span>
            `;
            container.appendChild(pill);
        });
    }

    function clearAttachedFiles() {
        attachedFiles = [];
        renderAttachmentPills();
    }

    // Drag-and-drop setup
    function setupDragAndDrop() {
        const chatArea = document.getElementById('mentor-messages-container');
        if (!chatArea) return;
        
        chatArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            chatArea.style.background = 'rgba(139, 92, 246, 0.05)';
        });
        
        chatArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            chatArea.style.background = '';
        });
        
        chatArea.addEventListener('drop', (e) => {
            e.preventDefault();
            chatArea.style.background = '';
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                const eventMock = { target: { files: files } };
                handleAuraFilesSelected(eventMock);
            }
        });
    }

    // Suggested prompts
    function renderSuggestedFollowUps(text) {
        const container = document.getElementById('aura-suggested-prompts');
        if (!container) return;
        
        container.innerHTML = '';
        container.style.display = 'none';
        
        let suggestions = [];
        if (text.toLowerCase().includes('code') || text.toLowerCase().includes('function') || text.toLowerCase().includes('error')) {
            suggestions = [
                "Can you explain how this code works?",
                "How do I debug this if it fails?",
                "Suggest some test cases for this."
            ];
        } else if (text.toLowerCase().includes('study plan') || text.toLowerCase().includes('schedule') || text.toLowerCase().includes('exam')) {
            suggestions = [
                "Can you adjust this schedule for 3 hours daily?",
                "How should I prioritize my weak areas in this plan?",
                "Suggest some revision milestones."
            ];
        } else if (text.toLowerCase().includes('career') || text.toLowerCase().includes('job') || text.toLowerCase().includes('resume')) {
            suggestions = [
                "What skills should I learn first for this role?",
                "What projects will make my resume stand out?",
                "Recommend some certifications."
            ];
        } else {
            suggestions = [
                "Can you explain this in more detail?",
                "Give me a concrete example.",
                "What are the next steps?"
            ];
        }
        
        container.style.display = 'flex';
        suggestions.forEach(promptText => {
            const chip = document.createElement('div');
            chip.className = 'aura-prompt-chip';
            chip.textContent = promptText;
            chip.addEventListener('click', () => {
                const input = document.getElementById('mentor-chat-input');
                if (input) {
                    input.value = promptText;
                    sendMentorMessage();
                }
            });
            container.appendChild(chip);
        });
    }

    // Tool Call rendering
    function appendToolCallUI(name, args, completed = false) {
        if (name === 'web_search') return; // Hide Wikipedia tool call from user
        const container = document.getElementById('mentor-messages-container');
        if (!container) return;
        
        const block = document.createElement('div');
        block.className = `tool-call-block ${completed ? 'completed' : ''}`;
        
        const iconMap = {
            web_search: '🔍',
            calculator: '🧮',
            execute_code: '💻',
            generate_image: '🎨',
            read_file: '📄'
        };
        const icon = iconMap[name] || '⚙️';
        const prettyName = name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
        
        let paramsText = "";
        if (name === 'web_search') paramsText = `query: "${args.query}"`;
        else if (name === 'calculator') paramsText = `expr: "${args.expression}"`;
        else if (name === 'execute_code') paramsText = `running JS code...`;
        else if (name === 'generate_image') paramsText = `prompt: "${args.prompt}"`;
        else if (name === 'read_file') paramsText = `reading "${args.filename}"...`;
        
        block.innerHTML = `
            <div class="tool-call-header">${icon} Calling tool: ${prettyName} (${paramsText}) ${completed ? '✅' : '...'}</div>
            <div class="tool-call-body" style="${completed ? '' : 'display:none;'}"></div>
        `;
        
        container.appendChild(block);
        scrollChatBottom();
    }

    function updateToolCallUI(name, result) {
        if (name === 'web_search') return; // Hide Wikipedia tool call from user
        const container = document.getElementById('mentor-messages-container');
        if (!container) return;
        
        const blocks = container.querySelectorAll(`.tool-call-block:not(.completed)`);
        let targetBlock = null;
        for (let i = blocks.length - 1; i >= 0; i--) {
            if (blocks[i].querySelector('.tool-call-header').textContent.includes(name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()))) {
                targetBlock = blocks[i];
                break;
            }
        }
        
        if (targetBlock) {
            targetBlock.classList.add('completed');
            const header = targetBlock.querySelector('.tool-call-header');
            if (header) header.innerHTML = header.innerHTML.replace('...', '✅');
            const body = targetBlock.querySelector('.tool-call-body');
            if (body) {
                body.style.display = 'block';
                body.textContent = JSON.stringify(result, null, 2);
            }
        }
        scrollChatBottom();
    }

    // Tool implementation executor
    async function executeTool(name, args) {
        try {
            if (name === "web_search") {
                const query = args.query || "";
                const cleanQuery = query.replace(/\s+/g, '_');
                const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQuery)}`;
                const resp = await fetch(url);
                if (resp.ok) {
                    const data = await resp.json();
                    return {
                        source: "Wikipedia",
                        title: data.title,
                        summary: data.extract,
                        url: data.content_urls?.desktop?.page
                    };
                } else {
                    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
                    const searchResp = await fetch(searchUrl);
                    const searchData = await searchResp.json();
                    const results = searchData.query?.search || [];
                    if (results.length > 0) {
                        return {
                            source: "Wikipedia Search Results",
                            results: results.slice(0, 3).map(r => ({ title: r.title, snippet: r.snippet.replace(/<[^>]*>/g, '') }))
                        };
                    }
                }
                return { result: `No direct search results found for: "${query}".` };
            }
            else if (name === "calculator") {
                const expr = args.expression || "";
                const cleanExpr = expr.replace(/[^0-9+\-*/().\sMathsqrtincoaep]/g, "");
                try {
                    const val = Function(`"use strict"; return (${cleanExpr})`)();
                    return { expression: expr, result: String(val) };
                } catch(e) {
                    return { error: `Calculation failed: ${e.message}` };
                }
            }
            else if (name === "execute_code") {
                const code = args.code || "";
                let logs = [];
                const customConsole = {
                    log: (...args) => {
                        logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
                    }
                };
                try {
                    const runFn = new Function('console', code);
                    const result = runFn(customConsole);
                    return { success: true, console_output: logs.join('\n'), returned_value: String(result) };
                } catch(e) {
                    return { success: false, error: e.message, console_output: logs.join('\n') };
                }
            }
            else if (name === "generate_image") {
                const prompt = args.prompt || "";
                const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`;
                return { prompt: prompt, image_url: imageUrl };
            }
            else if (name === "read_file") {
                const filename = args.filename || "";
                const file = attachedFiles.find(f => f.name === filename);
                if (file) {
                    return { filename: filename, content: file.data.slice(0, 5000) };
                }
                return { error: `File not found: "${filename}". Attached: ${attachedFiles.map(f => f.name).join(', ') || 'none'}` };
            }
        } catch(e) {
            return { error: `Tool execution failed: ${e.message}` };
        }
        return { error: `Unknown tool: ${name}` };
    }

    async function fetchWikipediaContext(query) {
        const simpleGreetings = ['hello', 'hi', 'hey', 'greetings', 'clear', 'exit', 'bye', 'thank you', 'thanks'];
        const cleanQuery = query.toLowerCase().trim();
        if (cleanQuery.length < 3 || simpleGreetings.includes(cleanQuery)) {
            return null;
        }
        try {
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
            const searchResp = await fetch(searchUrl);
            if (!searchResp.ok) return null;
            const searchData = await searchResp.json();
            const results = searchData.query?.search || [];
            if (results.length === 0) return null;
            
            const bestTitle = results[0].title;
            const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle.replace(/\s+/g, '_'))}`;
            const summaryResp = await fetch(summaryUrl);
            if (!summaryResp.ok) return null;
            const summaryData = await summaryResp.json();
            return {
                title: summaryData.title,
                extract: summaryData.extract,
                url: summaryData.content_urls?.desktop?.page
            };
        } catch(e) {
            console.warn("Silent Wikipedia fetch failed:", e);
            return null;
        }
    }

    // Call Gemini API (stream reader loop)
    async function callGeminiMentorAPI(lastUserMsg, overrideSystemPrompt = null) {
        const apiKey = localStorage.getItem('aura_api_key');
        if (!apiKey) {
            alert("Configure your Gemini API key first!");
            return;
        }

        showTyping();
        const statusSpan = document.getElementById('mentor-status');
        if (statusSpan) statusSpan.textContent = 'Thinking...';

        lastWikiContext = "";
        try {
            const wikiData = await fetchWikipediaContext(lastUserMsg);
            if (wikiData) {
                lastWikiContext = `\n\n[Wikipedia Search Knowledge Context for "${wikiData.title}":
${wikiData.extract}
Source: ${wikiData.url}]`;
            }
        } catch(e) {
            console.warn("Wikipedia pre-fetch error:", e);
        }

        const systemText = `You are Aura, an autonomous AI Success Agent and general-purpose conversational assistant.
A unique symbol for Aura is: ✧ Aura ✧ (representing glowing guidance).
Your goal is to guide students (${studentProfile.name}) in their academic journeys, career goals, study planning, and general inquiries.
Always behave as a modern, friendly, and highly capable conversational AI.
You have tools available: web_search, calculator, execute_code, generate_image, read_file.
If you need any information, perform a web_search or run calculations automatically.
If requested to generate an image, call generate_image and output the resulting Markdown image tag in your response: ![generated image](image_url).
Always respond with beautiful, readable Markdown including code blocks, lists, headings, and bold text.${lastWikiContext ? lastWikiContext + '\nUse the provided Wikipedia context as your primary source of facts for answering, integrating it naturally under your persona without mentioning a Wikipedia tool was run in the background.' : ''}`;

        const system_instruction = {
            parts: [{ text: systemText }]
        };

        const tools = [
            {
                function_declarations: [
                    {
                        name: "web_search",
                        description: "Retrieve search summary or facts from Wikipedia for a given query",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                query: { type: "STRING", description: "Search query" }
                            },
                            required: ["query"]
                        }
                    },
                    {
                        name: "calculator",
                        description: "Evaluate a mathematical expression securely",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                expression: { type: "STRING", description: "Expression to calculate (e.g. '3.14159 * Math.pow(5, 2)')" }
                            },
                            required: ["expression"]
                        }
                    },
                    {
                        name: "execute_code",
                        description: "Run Javascript code and capture logs and return values",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                code: { type: "STRING", description: "Javascript code block" }
                            },
                            required: ["code"]
                        }
                    },
                    {
                        name: "generate_image",
                        description: "Generate a custom image for a description",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                prompt: { type: "STRING", description: "Image generation prompt description" }
                            },
                            required: ["prompt"]
                        }
                    },
                    {
                        name: "read_file",
                        description: "Read text contents of an attached file",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                filename: { type: "STRING", description: "Filename of the attached file" }
                            },
                            required: ["filename"]
                        }
                    }
                ]
            }
        ];

        try {
            const streamUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:streamGenerateContent?key=${apiKey}`;
            
            let currentContent = chatMemory[chatMemory.length - 1];
            if (attachedFiles.length > 0) {
                const imageParts = attachedFiles
                    .filter(f => f.type.startsWith('image/'))
                    .map(f => ({
                        inlineData: {
                            mimeType: f.type,
                            data: f.data.split(',')[1]
                        }
                    }));
                if (imageParts.length > 0) {
                    currentContent.parts = [...imageParts, ...currentContent.parts];
                }
            }

            const response = await fetch(streamUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: chatMemory,
                    system_instruction: system_instruction,
                    tools: tools
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || `HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let finalResponseText = "";
            let isToolCall = false;
            let toolCallParts = [];
            let firstChunkProcessed = false;
            let openBrackets = 0;
            let startIdx = -1;
            let streamMessageEl = null;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                
                let searchIdx = 0;
                while (searchIdx < buffer.length) {
                    const char = buffer[searchIdx];
                    if (char === '{') {
                        if (openBrackets === 0) startIdx = searchIdx;
                        openBrackets++;
                    } else if (char === '}') {
                        openBrackets--;
                        if (openBrackets === 0 && startIdx !== -1) {
                            const jsonStr = buffer.slice(startIdx, searchIdx + 1);
                            try {
                                const chunk = JSON.parse(jsonStr);
                                const part = chunk.candidates?.[0]?.content?.parts?.[0];
                                
                                if (part) {
                                    if (part.functionCall) {
                                        isToolCall = true;
                                        toolCallParts.push(part.functionCall);
                                    } else if (part.text && !isToolCall) {
                                        if (!firstChunkProcessed) {
                                            firstChunkProcessed = true;
                                            hideTyping();
                                            if (statusSpan) statusSpan.textContent = 'Streaming...';
                                            streamMessageEl = createStreamingMessageUI('bot');
                                        }
                                        finalResponseText += part.text;
                                        updateStreamingMessageUI(streamMessageEl, finalResponseText);
                                    }
                                }
                            } catch(e) {}
                            startIdx = -1;
                        }
                    }
                    searchIdx++;
                }
                if (openBrackets === 0 && startIdx === -1) buffer = "";
            }
            
            hideTyping();
            if (statusSpan) statusSpan.textContent = 'Ready';

            if (isToolCall) {
                for (let fc of toolCallParts) {
                    chatMemory.push({ role: 'model', parts: [ { functionCall: fc } ] });
                    appendToolCallUI(fc.name, fc.args);
                    const result = await executeTool(fc.name, fc.args);
                    chatMemory.push({
                        role: 'function',
                        parts: [ { functionResponse: { name: fc.name, response: result } } ]
                    });
                    updateToolCallUI(fc.name, result);
                }
                clearAttachedFiles();
                await callGeminiMentorAPIAfterTool();
            } else {
                if (streamMessageEl) finalizeStreamingMessageUI(streamMessageEl, finalResponseText);
                chatMemory.push({ role: 'model', parts: [{ text: finalResponseText }] });
                if (autoTTS) speakText(finalResponseText);
                clearAttachedFiles();
                updateActiveConversationHistory();
                if (activeConversationId === 'default_academic' && studentProfile.isLoggedIn) {
                    await saveChatMessage('bot', finalResponseText);
                }
                renderSuggestedFollowUps(finalResponseText);
            }
        } catch(e) {
            hideTyping();
            if (statusSpan) statusSpan.textContent = 'Ready';
            appendMessageUI('bot', `⚠️ Error calling Aura: ${e.message}`);
        }
    }

    async function callGeminiMentorAPIAfterTool() {
        const apiKey = localStorage.getItem('aura_api_key');
        showTyping();
        const statusSpan = document.getElementById('mentor-status');
        if (statusSpan) statusSpan.textContent = 'Thinking...';

        const systemText = `You are Aura, an autonomous AI Success Agent and general-purpose conversational assistant.
A unique symbol for Aura is: ✧ Aura ✧ (representing glowing guidance).
Your goal is to guide students (${studentProfile.name}) in their academic journeys, career goals, study planning, and general inquiries.
Always behave as a modern, friendly, and highly capable conversational AI.
You have tools available: web_search, calculator, execute_code, generate_image, read_file.
If you need any information, perform a web_search or run calculations automatically.
If requested to generate an image, call generate_image and output the resulting Markdown image tag in your response: ![generated image](image_url).
Always respond with beautiful, readable Markdown including code blocks, lists, headings, and bold text.${lastWikiContext ? lastWikiContext + '\nUse the provided Wikipedia context as your primary source of facts for answering, integrating it naturally under your persona without mentioning a Wikipedia tool was run in the background.' : ''}`;

        const system_instruction = { parts: [{ text: systemText }] };
        const tools = [
            {
                function_declarations: [
                    {
                        name: "web_search",
                        description: "Retrieve search summary or facts from Wikipedia for a given query",
                        parameters: {
                            type: "OBJECT",
                            properties: { query: { type: "STRING" } },
                            required: ["query"]
                        }
                    },
                    {
                        name: "calculator",
                        description: "Evaluate a mathematical expression securely",
                        parameters: {
                            type: "OBJECT",
                            properties: { expression: { type: "STRING" } },
                            required: ["expression"]
                        }
                    },
                    {
                        name: "execute_code",
                        description: "Run Javascript code",
                        parameters: {
                            type: "OBJECT",
                            properties: { code: { type: "STRING" } },
                            required: ["code"]
                        }
                    },
                    {
                        name: "generate_image",
                        description: "Generate a custom image for a description",
                        parameters: {
                            type: "OBJECT",
                            properties: { prompt: { type: "STRING" } },
                            required: ["prompt"]
                        }
                    },
                    {
                        name: "read_file",
                        description: "Read text contents of an attached file",
                        parameters: {
                            type: "OBJECT",
                            properties: { filename: { type: "STRING" } },
                            required: ["filename"]
                        }
                    }
                ]
            }
        ];

        try {
            let maxIterations = 5;
            let iteration = 0;
            let isDone = false;
            let finalResponseText = "";
            
            while (!isDone && iteration < maxIterations) {
                iteration++;
                const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: chatMemory,
                        system_instruction: system_instruction,
                        tools: tools
                    })
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error?.message || `HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                const part = data.candidates?.[0]?.content?.parts?.[0];
                
                if (part && part.functionCall) {
                    const fc = part.functionCall;
                    chatMemory.push({ role: 'model', parts: [ { functionCall: fc } ] });
                    appendToolCallUI(fc.name, fc.args);
                    const result = await executeTool(fc.name, fc.args);
                    chatMemory.push({
                        role: 'function',
                        parts: [ { functionResponse: { name: fc.name, response: result } } ]
                    });
                    updateToolCallUI(fc.name, result);
                } else if (part && part.text) {
                    finalResponseText = part.text;
                    isDone = true;
                } else {
                    isDone = true;
                }
            }
            
            hideTyping();
            if (statusSpan) statusSpan.textContent = 'Ready';
            
            if (finalResponseText) {
                chatMemory.push({ role: 'model', parts: [{ text: finalResponseText }] });
                appendMessageUI('bot', finalResponseText);
                if (autoTTS) speakText(finalResponseText);
                updateActiveConversationHistory();
                if (activeConversationId === 'default_academic' && studentProfile.isLoggedIn) {
                    await saveChatMessage('bot', finalResponseText);
                }
                renderSuggestedFollowUps(finalResponseText);
            }
        } catch(e) {
            hideTyping();
            if (statusSpan) statusSpan.textContent = 'Ready';
            appendMessageUI('bot', `⚠️ Error calling Aura: ${e.message}`);
        }
    }

    function createStreamingMessageUI(sender) {
        const container = document.getElementById('mentor-messages-container');
        if (!container) return null;
        const msgDiv = document.createElement('div');
        msgDiv.className = `mentor-message ${sender} streaming-msg`;
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerHTML = '<span class="typing-dot" style="display:inline-block;animation:typing-bounce 1s infinite;">.</span>';
        msgDiv.appendChild(bubble);
        container.appendChild(msgDiv);
        scrollChatBottom();
        return msgDiv;
    }

    function updateStreamingMessageUI(msgDiv, text) {
        if (!msgDiv) return;
        const bubble = msgDiv.querySelector('.message-bubble');
        if (bubble) bubble.innerHTML = formatMarkdown(text);
        scrollChatBottom();
    }

    function finalizeStreamingMessageUI(msgDiv, text) {
        if (!msgDiv) return;
        msgDiv.classList.remove('streaming-msg');
        const bubble = msgDiv.querySelector('.message-bubble');
        if (bubble) {
            bubble.innerHTML = formatMarkdown(text);
            addMessageInteractionControls(msgDiv, 'bot', text);
        }
        scrollChatBottom();
    }

    // Quick Actions
    window.triggerQuickAction = function(actionType) {
        let text = '';
        if (actionType === 'career') {
            text = `Provide personalized career guidance based on my success profile. Highlight portfolio projects, online resources, and certifications that match my career goals (${successProfile.target_goals || 'unspecified'}) and weak areas (${successProfile.weak_subjects || 'none'}).`;
        } 
        else if (actionType === 'planner') {
            if (!successProfile.exam_date || !successProfile.exam_subjects) {
                alert("Please configure default planner defaults (Exam Date and Subjects) in the Success Profile tab first!");
                switchMentorTab('profile');
                return;
            }
            text = `Generate a personalized study plan default schedule for my exam on ${successProfile.exam_date}. Subjects to cover: ${successProfile.exam_subjects}. Daily hour allocation: ${successProfile.study_hours || '4'} hours. Weak areas to prioritize: ${successProfile.weak_subjects || 'none'}. Format the hourly schedule as a markdown table.`;
        } 
        else if (actionType === 'predictor') {
            if (!successProfile.exam_rank) {
                alert("Please configure your Exam Rank in the Success Profile tab first!");
                switchMentorTab('profile');
                return;
            }
            text = `Recommend engineering or graduate colleges based on my rank of ${successProfile.exam_rank}, category ${successProfile.category}, state ${successProfile.state || 'any'}, and preferred branch ${successProfile.dept.toUpperCase()}. Provide realistic predictions (premium, intermediate, and safety options).`;
        } 
        else if (actionType === 'doubt') {
            text = `I have an academic doubt about my current subjects. Can you explain key concepts in detail and suggest a study strategy?`;
        }

        if (text) {
            switchMentorTab('chat');
            document.getElementById('mentor-chat-input').value = text;
            document.getElementById('mentor-chat-input').focus();
        }
    };

    // Proactive Recommendations on Dashboard
    window.fetchProactiveRecommendations = async function() {
        const apiKey = localStorage.getItem('aura_api_key');
        if (!apiKey) {
            alert("Configure your Gemini API key first!");
            return;
        }

        const output = document.getElementById('dashboard-recommendations-list');
        if (!output) return;
        output.innerHTML = '<p style="text-align: center; color: var(--text-muted);">🤖 Aura Success Agent is analyzing your profile to compile weekly insights...</p>';

        const promptText = `Generate weekly academic goals, suggested learning activities, skill recommendations based on career goals, and placement readiness suggestions.
Profile:
- Branch: ${successProfile.dept.toUpperCase()}
- Year: Year ${successProfile.grade}
- Interests: ${successProfile.interests}
- Weak Subjects: ${successProfile.weak_subjects}
- Career Aspirations: ${successProfile.target_goals}

Return the results as brief, structured bullet points grouped into:
1. **Weekly Academic Goals**
2. **Suggested Learning Activities**
3. **Skill Recommendations**
4. **Placement Readiness & Exam Prep**`;

        try {
            const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: promptText }] }]
                })
            });

            if (!response.ok) throw new Error("API request failed");
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                output.innerHTML = formatMarkdown(text);
            } else {
                throw new Error("Invalid output");
            }
        } catch (e) {
            output.innerHTML = `<p style="color: #ef4444; text-align: center;">Error fetching recommendations: ${e.message}</p>`;
        }
    };

    // Load Resource recommendations
    window.fetchMentorResourceRecommendations = async function() {
        const apiKey = localStorage.getItem('aura_api_key');
        if (!apiKey) {
            alert("Configure your Gemini API key first!");
            return;
        }

        const output = document.getElementById('resources-recommendation-output');
        if (!output) return;
        output.innerHTML = '<p style="text-align: center; color: var(--text-muted);">🤖 Fetching tailored courses, tutorials, and certifications...</p>';

        const promptText = `Recommend tailored online courses, certifications, textbooks, coding practice platforms, and portfolio project ideas based on the following profile. Explain WHY each resource is recommended.
Profile:
- Branch: ${successProfile.dept.toUpperCase()}
- Year: Year ${successProfile.grade}
- Interests: ${successProfile.interests}
- Weak Subjects: ${successProfile.weak_subjects}
- Career Aspirations: ${successProfile.target_goals}

Format with bold headers and structured bullet points.`;

        try {
            const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: promptText }] }]
                })
            });

            if (!response.ok) throw new Error("API request failed");
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                output.innerHTML = formatMarkdown(text);
            } else {
                throw new Error("Invalid output");
            }
        } catch (e) {
            output.innerHTML = `<p style="color: #ef4444; text-align: center;">Error fetching resources: ${e.message}</p>`;
        }
    };

    // Trigger Adaptive Study Plan Re-planning
    window.triggerAdaptiveReplan = async function() {
        const missedVal = document.getElementById('adapt-days-missed').value;
        const progressVal = document.getElementById('adapt-current-status').value.trim();

        if (!successProfile.exam_date || !successProfile.exam_subjects) {
            alert("Planner defaults (Exam Date and Subjects) must be configured in the Success Profile tab first!");
            switchMentorTab('profile');
            return;
        }

        const replanPrompt = `I need to adapt my study plan and regenerate my daily schedule.
- I fell behind and missed ${missedVal} days of study.
- My current milestone progress: ${progressVal || 'No major progress completed yet.'}
- My target exam date is still: ${successProfile.exam_date}
- Target subjects: ${successProfile.exam_subjects}
- Daily study hour allocation: ${successProfile.study_hours || '4'} hours
- My weak subjects to prioritize: ${successProfile.weak_subjects || 'none'}

Please regenerate my hourly daily timetable study plan, prioritizing weak areas, and distribute the remaining content adaptively. Format the daily schedule as a markdown table!`;

        switchMentorTab('chat');
        document.getElementById('mentor-chat-input').value = replanPrompt;
        document.getElementById('mentor-chat-input').focus();
    };

    // Save Study Plan
    async function saveGeneratedPlan(planText) {
        let title = prompt("Enter a title for this Study Plan:", "Adaptive Study Plan");
        if (title === null) return;
        title = title.trim() || "Study Plan";

        if (studentProfile.isLoggedIn && studentProfile.email) {
            try {
                const resp = await fetch('/api/mentor/plans', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: studentProfile.email,
                        title: title,
                        plan_data: planText
                    })
                });
                const data = await resp.json();
                if (data.success) {
                    const studyPlanCheck = document.getElementById('chk-study-plan');
                    if (studyPlanCheck) studyPlanCheck.checked = true;
                    updateConsistency();
                    alert("Study plan saved to database successfully!");
                    loadSavedPlans();
                } else {
                    alert("Failed to save: " + data.message);
                }
            } catch (e) {
                alert("Error: " + e.message);
            }
        } else {
            const guestPlans = JSON.parse(localStorage.getItem('mentor_study_plans_guest') || '[]');
            guestPlans.unshift({
                id: Date.now(),
                title: title,
                plan_data: planText,
                created_at: new Date().toISOString()
            });
            localStorage.setItem('mentor_study_plans_guest', JSON.stringify(guestPlans));
            const studyPlanCheck = document.getElementById('chk-study-plan');
            if (studyPlanCheck) studyPlanCheck.checked = true;
            updateConsistency();
            alert("Study plan saved to Guest local storage!");
            loadSavedPlans();
        }
    }

    // Load plans
    async function loadSavedPlans() {
        const listContainer = document.getElementById('saved-plans-list');
        const overviewContainer = document.getElementById('adaptive-saved-plans-overview');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        if (overviewContainer) overviewContainer.innerHTML = '';

        let plans = [];
        if (studentProfile.isLoggedIn && studentProfile.email) {
            try {
                const resp = await fetch(`/api/mentor/plans?email=${encodeURIComponent(studentProfile.email)}`);
                const data = await resp.json();
                if (data.success) {
                    plans = data.plans || [];
                }
            } catch(e) {
                console.warn(e);
            }
        } else {
            plans = JSON.parse(localStorage.getItem('mentor_study_plans_guest') || '[]');
        }

        if (plans.length > 0) {
            const studyPlanCheck = document.getElementById('chk-study-plan');
            if (studyPlanCheck) studyPlanCheck.checked = true;
        }

        if (plans.length === 0) {
            const emptyText = '<p style="font-size: 11.5px; color: var(--text-muted); margin: 0; text-align: center; padding: 10px 0;">No saved study plans yet.</p>';
            listContainer.innerHTML = emptyText;
            if (overviewContainer) overviewContainer.innerHTML = emptyText;
            return;
        }

        // Render in both places
        plans.forEach(plan => {
            // Sidebar item
            const item = document.createElement('div');
            item.className = 'plan-item';
            
            const info = document.createElement('div');
            info.className = 'plan-item-info';
            info.addEventListener('click', () => {
                openPlanViewerModal(plan.title, plan.plan_data);
            });
            
            const titleSpan = document.createElement('div');
            titleSpan.className = 'plan-item-title';
            titleSpan.textContent = plan.title;
            
            const dateSpan = document.createElement('div');
            dateSpan.className = 'plan-item-date';
            const date = new Date(plan.created_at);
            dateSpan.textContent = date.toLocaleDateString();
            
            info.appendChild(titleSpan);
            info.appendChild(dateSpan);
            
            const actions = document.createElement('div');
            actions.className = 'plan-item-actions';
            
            const viewBtn = document.createElement('button');
            viewBtn.className = 'plan-action-btn';
            viewBtn.innerHTML = '👁️';
            viewBtn.addEventListener('click', () => {
                openPlanViewerModal(plan.title, plan.plan_data);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'plan-action-btn delete';
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.addEventListener('click', () => {
                deletePlan(plan.id);
            });

            actions.appendChild(viewBtn);
            actions.appendChild(deleteBtn);
            
            item.appendChild(info);
            item.appendChild(actions);
            listContainer.appendChild(item);

            // Adaptive view item (copy)
            if (overviewContainer) {
                const clone = item.cloneNode(true);
                clone.querySelector('.plan-item-info').addEventListener('click', () => {
                    openPlanViewerModal(plan.title, plan.plan_data);
                });
                clone.querySelectorAll('.plan-action-btn')[0].addEventListener('click', () => {
                    openPlanViewerModal(plan.title, plan.plan_data);
                });
                clone.querySelectorAll('.plan-action-btn')[1].addEventListener('click', () => {
                    deletePlan(plan.id);
                });
                overviewContainer.appendChild(clone);
            }
        });
    }

    async function deletePlan(planId) {
        if (!confirm("Delete this study plan?")) return;

        if (studentProfile.isLoggedIn && studentProfile.email) {
            try {
                const resp = await fetch(`/api/mentor/plans?email=${encodeURIComponent(studentProfile.email)}&id=${planId}`, {
                    method: 'DELETE'
                });
                const data = await resp.json();
                if (data.success) {
                    alert("Study plan deleted.");
                    loadSavedPlans();
                }
            } catch (e) {
                alert("Error: " + e.message);
            }
        } else {
            let guestPlans = JSON.parse(localStorage.getItem('mentor_study_plans_guest') || '[]');
            guestPlans = guestPlans.filter(p => p.id !== planId);
            localStorage.setItem('mentor_study_plans_guest', JSON.stringify(guestPlans));
            alert("Deleted plan.");
            loadSavedPlans();
        }
    }

    window.openPlanViewerModal = function(title, planText) {
        const modal = document.getElementById('plan-viewer-modal');
        document.getElementById('plan-viewer-title').textContent = title;
        document.getElementById('plan-viewer-body').innerHTML = formatMarkdown(planText);
        modal.classList.add('active');
    };

    window.closePlanViewerModal = function() {
        document.getElementById('plan-viewer-modal').classList.remove('active');
    };


    // ==========================================
    // PRACTICE QUIZZES PORTED CONTROLLERS
    // ==========================================
    
    function shuffleArray(arr) {
        let copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    window.startAuraQuiz = function(subject) {
        const bank = QUIZ_BANKS[subject];
        if (!bank || bank.length === 0) {
            alert("Subject quiz bank not configured.");
            return;
        }

        const shuffled = shuffleArray(bank);
        quizState.active = true;
        quizState.subject = subject;
        quizState.questions = shuffled.slice(0, 3); // Quiz draws 3 questions
        quizState.questionIndex = 0;
        quizState.score = 0;

        document.getElementById('quiz-selection-area').style.display = 'none';
        document.getElementById('quiz-results-box').style.display = 'none';
        document.getElementById('active-quiz-box').style.display = 'block';

        presentAuraQuestion();
    };

    function presentAuraQuestion() {
        const currentQ = quizState.questions[quizState.questionIndex];
        const subjectNames = {
            html: "HTML basics",
            css: "CSS grids and layouts",
            js: "JavaScript core",
            python: "Python scripts",
            sql: "SQL database queries",
            c: "C pointers & memory",
            dsa: "Data structures & algorithms"
        };

        document.getElementById('quiz-subject-header').textContent = `✏️ ${subjectNames[quizState.subject].toUpperCase()}`;
        document.getElementById('quiz-progress-text').textContent = `Question ${quizState.questionIndex + 1}/3`;
        document.getElementById('quiz-question-text').textContent = currentQ.q;

        const optionsContainer = document.getElementById('quiz-options-container');
        optionsContainer.innerHTML = '';
        document.getElementById('quiz-feedback-box').style.display = 'none';
        document.getElementById('quiz-next-btn').style.display = 'none';

        // Render Options A, B, C
        Object.keys(currentQ.options).forEach(key => {
            const optBtn = document.createElement('button');
            optBtn.className = 'aura-quiz-option';
            optBtn.innerHTML = `<strong>${key})</strong> ${currentQ.options[key]}`;
            optBtn.addEventListener('click', () => submitAuraQuizAnswer(key));
            optionsContainer.appendChild(optBtn);
        });
    }

    function submitAuraQuizAnswer(choice) {
        const currentQ = quizState.questions[quizState.questionIndex];
        const optionsContainer = document.getElementById('quiz-options-container');
        const feedbackBox = document.getElementById('quiz-feedback-box');
        const nextBtn = document.getElementById('quiz-next-btn');

        // Disable all option clicks and add feedback color classes
        const optButtons = optionsContainer.querySelectorAll('.aura-quiz-option');
        optButtons.forEach(btn => {
            btn.disabled = true;
            const letter = btn.innerText.substring(0, 1);
            if (letter === currentQ.correct) {
                btn.className = 'aura-quiz-option correct';
            } else if (letter === choice) {
                btn.className = 'aura-quiz-option incorrect';
            }
        });

        const isCorrect = (choice === currentQ.correct);
        if (isCorrect) {
            quizState.score++;
            feedbackBox.style.background = '#d1fae5';
            feedbackBox.style.color = '#065f46';
            feedbackBox.style.border = '1px solid #10b981';
            feedbackBox.innerHTML = `🟢 <strong>Correct Answer!</strong><br>${currentQ.exp}`;
        } else {
            feedbackBox.style.background = '#fee2e2';
            feedbackBox.style.color = '#991b1b';
            feedbackBox.style.border = '1px solid #ef4444';
            feedbackBox.innerHTML = `🔴 <strong>Incorrect.</strong> The correct answer was <strong>${currentQ.correct}) ${currentQ.options[currentQ.correct]}</strong>.<br>${currentQ.exp}`;
        }

        feedbackBox.style.display = 'block';
        nextBtn.style.display = 'block';
    }

    window.nextAuraQuizQuestion = function() {
        quizState.questionIndex++;
        if (quizState.questionIndex >= 3) {
            finishAuraQuiz();
        } else {
            presentAuraQuestion();
        }
    };

    function finishAuraQuiz() {
        document.getElementById('active-quiz-box').style.display = 'none';
        
        const resultsBox = document.getElementById('quiz-results-box');
        const scoreSummary = document.getElementById('quiz-score-summary');
        const scoreMessage = document.getElementById('quiz-score-message');
        const retryBtn = document.getElementById('quiz-retry-btn');

        scoreSummary.textContent = `You scored ${quizState.score}/3`;
        
        let msg = '';
        if (quizState.score === 3) {
            msg = "Perfect score! You are mastering this subject perfectly! 🌟 Keep it up.";
        } else if (quizState.score >= 2) {
            msg = "Good job! Check the curriculum checklists and guides to patch up any minor gaps. 📚";
        } else {
            msg = "Keep practicing! Repeating checkoffs and reviewing guides is key to solid learning. 💪";
        }
        scoreMessage.textContent = msg;

        // Configure Retry Button
        retryBtn.onclick = () => {
            startAuraQuiz(quizState.subject);
        };

        resultsBox.style.display = 'block';
    }

    window.exitAuraQuiz = function() {
        quizState.active = false;
        document.getElementById('active-quiz-box').style.display = 'none';
        document.getElementById('quiz-results-box').style.display = 'none';
        document.getElementById('quiz-selection-area').style.display = 'grid';
    };


    // ==========================================
    // MARKDOWN FORMATTER HELPER
    // ==========================================

    function formatMarkdown(text) {
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Code blocks
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(match, lang, code) {
            return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
        });

        // Inline code
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
        html = html.replace(/(?:<li>.*<\/li>\s*)+/g, function(match) {
            return `<ul>${match}</ul>`;
        });

        // Table Parsing
        const lines = html.split('\n');
        let inTable = false;
        let tableRows = [];
        let processedLines = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line.startsWith('|') && line.endsWith('|')) {
                if (!inTable) {
                    inTable = true;
                    tableRows = [];
                }
                tableRows.push(line);
            } else {
                if (inTable) {
                    processedLines.push(renderHTMLTable(tableRows));
                    inTable = false;
                }
                processedLines.push(lines[i]);
            }
        }
        if (inTable) {
            processedLines.push(renderHTMLTable(tableRows));
        }
        html = processedLines.join('\n');

        const preBlocks = [];
        html = html.replace(/<pre>[\s\S]*?<\/pre>/g, function(match) {
            preBlocks.push(match);
            return `__PRE_BLOCK_${preBlocks.length - 1}__`;
        });

        const tableBlocks = [];
        html = html.replace(/<table[\s\S]*?<\/table>/g, function(match) {
            tableBlocks.push(match);
            return `__TABLE_BLOCK_${tableBlocks.length - 1}__`;
        });

        html = html.replace(/\n/g, '<br>');

        preBlocks.forEach((block, idx) => {
            html = html.replace(`__PRE_BLOCK_${idx}__`, block);
        });

        tableBlocks.forEach((block, idx) => {
            html = html.replace(`__TABLE_BLOCK_${idx}__`, block);
        });

        return html;
    }

    function renderHTMLTable(rows) {
        if (rows.length < 1) return "";
        let html = "<table>";
        let hasHeader = false;
        if (rows.length > 1 && rows[1].includes('-')) {
            hasHeader = true;
        }
        for (let i = 0; i < rows.length; i++) {
            if (i === 1 && hasHeader) continue;
            let row = rows[i];
            let cols = row.split('|').map(c => c.trim());
            if (cols[0] === '') cols.shift();
            if (cols[cols.length - 1] === '') cols.pop();
            
            html += "<tr>";
            for (let j = 0; j < cols.length; j++) {
                if (i === 0 && hasHeader) {
                    html += `<th>${cols[j]}</th>`;
                } else {
                    html += `<td>${cols[j]}</td>`;
                }
            }
            html += "</tr>";
        }
        html += "</table>";
        return html;
    }

})();
