// Load and apply theme & font size on start so all pages stay synchronized
(function() {
    function applySettings() {
        const savedTheme = localStorage.getItem('siteTheme') || 'default';
        const savedFontSize = localStorage.getItem('siteFontSize') || 'medium';
        const savedViewMode = localStorage.getItem('siteViewMode') || 'laptop';

        // Apply theme and font size classes to body
        document.body.classList.remove('theme-light', 'theme-dark', 'font-size-small', 'font-size-medium', 'font-size-large');
        if (savedTheme !== 'default') {
            document.body.classList.add('theme-' + savedTheme);
        }
        document.body.classList.add('font-size-' + savedFontSize);

        // Apply view mode classes to body
        document.body.classList.remove('view-mode-phone', 'view-mode-tab', 'view-mode-laptop', 'view-mode-active-body');
        if (savedViewMode === 'phone') {
            document.body.classList.add('view-mode-phone', 'view-mode-active-body');
        } else if (savedViewMode === 'tab') {
            document.body.classList.add('view-mode-tab', 'view-mode-active-body');
        } else {
            document.body.classList.add('view-mode-laptop');
        }

        // Sync dropdown selectors on the current page if they exist
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = savedTheme;
        }
        const fontSelect = document.getElementById('font-size-select');
        if (fontSelect) {
            fontSelect.value = savedFontSize;
        }
        const viewModeSelect = document.getElementById('view-mode-select');
        if (viewModeSelect) {
            viewModeSelect.value = savedViewMode;
        }
    }

    // Expose change settings functions globally
    window.changeTheme = function(themeName) {
        localStorage.setItem('siteTheme', themeName);
        applySettings();
    };

    window.changeFontSize = function(fontSizeName) {
        localStorage.setItem('siteFontSize', fontSizeName);
        applySettings();
    };

    window.changeViewMode = function(viewModeName) {
        localStorage.setItem('siteViewMode', viewModeName);
        applySettings();
    };

    function standardizeSubjectPage() {
        try {
            const path = window.location.pathname || '';
            const fileName = path.split('/').pop() || document.location.href.split('/').pop() || '';
            
            // Strip query parameters and hash to get a clean file name
            const cleanFileName = fileName.split('?')[0].split('#')[0];
            const subjectKey = cleanFileName.toLowerCase().replace('.html', '');
            
            // List of valid academic subject keys
            const validSubjects = ['c', 'cn', 'css', 'dbms', 'dsa', 'html', 'java', 'javascript', 'os', 'postgresql', 'python', 'reactjs', 'sql'];
            
            if (!validSubjects.includes(subjectKey)) return;

            // 1. Wrap the body content in .app-container if not already present
            if (!document.querySelector('.app-container')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'app-container';
                while (document.body.firstChild) {
                    wrapper.appendChild(document.body.firstChild);
                }
                document.body.appendChild(wrapper);
            }

            const wrapper = document.querySelector('.app-container');

            // 2. Remove the legacy <h2>Navigation</h2> and old horizontal rules at the top
            const headings = wrapper.querySelectorAll('h2');
            headings.forEach(h2 => {
                if (h2.textContent.toLowerCase().includes('navigation')) {
                    h2.remove();
                }
            });

            const hrs = wrapper.querySelectorAll('hr');
            hrs.forEach((hr, idx) => {
                if (idx < 2) hr.remove();
            });

            // Remove legacy nav element if present
            const oldNav = wrapper.querySelector('nav');
            if (oldNav) oldNav.remove();

            // 3. Prepend the standard beautiful Student Hub header
            const headerContainer = document.createElement('div');
            headerContainer.className = 'standard-header';
            headerContainer.innerHTML = `
                <center>
                    <h1>Student Hub</h1>
                    <p>Your step-by-step guide to Computer Science and Web Development.</p>
                </center>
                <hr>
                <nav>
                    <a href="index.html">Home</a>
                    <a href="signup.html">Signup</a>
                    <a href="reference.html">References</a>
                </nav>
                <hr>
            `;
            wrapper.insertBefore(headerContainer, wrapper.firstChild);

            // 4. Append the standard beautiful Student Hub footer
            if (!wrapper.querySelector('.app-footer')) {
                const footerContainer = document.createElement('footer');
                footerContainer.className = 'app-footer';
                footerContainer.style.marginTop = '40px';
                footerContainer.style.paddingTop = '20px';
                footerContainer.style.borderTop = '1px solid var(--border-color)';
                footerContainer.style.textAlign = 'center';
                footerContainer.style.color = 'var(--text-muted)';
                footerContainer.style.fontSize = '13px';
                footerContainer.innerHTML = `<p>&copy; 2026 Student Hub. All Rights Reserved. Protected by Academic and Software Copyright.</p>`;
                wrapper.appendChild(footerContainer);
            }
        } catch (e) {
            console.error('Error standardizing subject page:', e);
        }
    }

    function injectSettingsBar() {
        // If theme-select is already in the DOM, just sync and return
        if (document.getElementById('theme-select')) {
            applySettings();
            return;
        }

        // Find the nav element on the page to append settings bar
        const nav = document.querySelector('nav');
        if (!nav) return;

        const settingsBar = document.createElement('div');
        settingsBar.id = 'site-settings-bar';

        const savedTheme = localStorage.getItem('siteTheme') || 'default';
        const savedFontSize = localStorage.getItem('siteFontSize') || 'medium';
        const savedViewMode = localStorage.getItem('siteViewMode') || 'laptop';

        settingsBar.innerHTML = `
            <label for="theme-select" class="settings-label">Theme: </label>
            <select id="theme-select" onchange="changeTheme(this.value)" class="settings-select">
                <option value="default">Royal Amethyst & Lavender</option>
                <option value="light">Light Teal & Sage</option>
                <option value="dark">Dark Charcoal</option>
            </select>
            <label for="font-size-select" class="settings-label">Font Size: </label>
            <select id="font-size-select" onchange="changeFontSize(this.value)" class="settings-select">
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
            </select>
            <label for="view-mode-select" class="settings-label">View Mode: </label>
            <select id="view-mode-select" onchange="changeViewMode(this.value)" class="settings-select">
                <option value="laptop">Laptop</option>
                <option value="tab">Tablet</option>
                <option value="phone">Phone</option>
            </select>
        `;

        // Insert after nav
        nav.parentNode.insertBefore(settingsBar, nav.nextSibling);

        applySettings();
    }
    
    function injectViewModeStyles() {
        if (document.getElementById('view-mode-styles')) return;

        // Dynamic style injection to bypass any cached style.css issues
        const style = document.createElement('style');
        style.id = 'view-mode-styles';
        style.innerHTML = `
            body.view-mode-active-body {
                background-color: #0f172a !important;
                transition: background-color 0.3s ease;
                padding-top: 0 !important;
                box-sizing: border-box;
            }
            body.view-mode-phone {
                display: flex !important;
                justify-content: center !important;
                align-items: flex-start !important;
            }
            body.view-mode-phone .app-container,
            body.view-mode-phone .admin-container {
                width: 375px !important;
                max-width: 375px !important;
                height: 780px !important;
                overflow-y: auto !important;
                border: 14px solid #000000 !important;
                border-radius: 40px !important;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
                margin: 40px auto !important;
                background-color: var(--bg-card, #ffffff) !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                box-sizing: border-box !important;
                position: relative !important;
            }
            body.view-mode-tab {
                display: flex !important;
                justify-content: center !important;
                align-items: flex-start !important;
            }
            body.view-mode-tab .app-container,
            body.view-mode-tab .admin-container {
                width: 768px !important;
                max-width: 768px !important;
                height: 1024px !important;
                overflow-y: auto !important;
                border: 18px solid #000000 !important;
                border-radius: 28px !important;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
                margin: 40px auto !important;
                background-color: var(--bg-card, #ffffff) !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                box-sizing: border-box !important;
                position: relative !important;
            }
            body.view-mode-phone .track-card,
            body.view-mode-phone .platform-card,
            body.view-mode-tab .track-card,
            body.view-mode-tab .platform-card {
                width: 96% !important;
                float: none !important;
                display: block !important;
                margin: 10px auto !important;
            }
            body.view-mode-phone .ref-links-grid li,
            body.view-mode-tab .ref-links-grid li {
                width: 100% !important;
                margin: 0 !important;
            }
            body.view-mode-phone .reference-layout,
            body.view-mode-tab .reference-layout {
                flex-direction: column !important;
            }
            body.view-mode-phone .reference-layout aside,
            body.view-mode-tab .reference-layout aside {
                width: 100% !important;
                position: static !important;
                margin-bottom: 20px !important;
            }
            body.view-mode-phone .reference-layout main,
            body.view-mode-tab .reference-layout main {
                margin-left: 0 !important;
            }
            body.view-mode-phone .modal-footer-info,
            body.view-mode-phone .modal-footer-buttons,
            body.view-mode-tab .modal-footer-info,
            body.view-mode-tab .modal-footer-buttons {
                float: none !important;
                display: block !important;
                text-align: center !important;
                margin-bottom: 10px !important;
            }
            body.view-mode-phone .control-row,
            body.view-mode-tab .control-row {
                flex-direction: column !important;
                align-items: stretch !important;
            }
            body.view-mode-phone .ref-control-left,
            body.view-mode-phone .ref-control-right,
            body.view-mode-tab .ref-control-left,
            body.view-mode-tab .ref-control-right {
                text-align: center !important;
                width: 100% !important;
            }
            body.view-mode-phone .ref-control-left .search-input,
            body.view-mode-tab .ref-control-left .search-input {
                width: 100% !important;
                max-width: 100% !important;
                margin-bottom: 10px !important;
            }
            body.view-mode-phone .ref-control-left label,
            body.view-mode-phone .ref-control-left select,
            body.view-mode-tab .ref-control-left label,
            body.view-mode-tab .ref-control-left select {
                display: block !important;
                margin: 10px auto !important;
                width: 100% !important;
            }
            body.view-mode-phone .tracks-title,
            body.view-mode-phone .search-container-right,
            body.view-mode-tab .tracks-title,
            body.view-mode-tab .search-container-right {
                float: none !important;
                text-align: center !important;
                width: 100% !important;
                margin-bottom: 10px !important;
            }
            body.view-mode-phone .search-container-right,
            body.view-mode-tab .search-container-right {
                margin: 0 auto !important;
            }
            body.view-mode-phone .filter-group,
            body.view-mode-tab .filter-group {
                width: 96% !important;
                margin-right: 0 !important;
                margin-bottom: 10px !important;
            }
        `;
        document.head.appendChild(style);
        applySettings();
    }

    function initPage() {
        standardizeSubjectPage();
        injectSettingsBar();
        injectViewModeStyles();
    }

    if (document.body) {
        initPage();
    } else {
        document.addEventListener("DOMContentLoaded", initPage);
    }

    // Listen for storage events (updates in other tabs/windows)
    window.addEventListener('storage', function(e) {
        if (e.key === 'siteTheme' || e.key === 'siteFontSize' || e.key === 'siteViewMode') {
            applySettings();
        }
        if (e.key === 'isLoggedIn' || e.key === null) {
            const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
            const path = window.location.pathname || '';
            const fileName = path.split('/').pop() || document.location.href.split('/').pop() || '';
            const isReferencePage = fileName.toLowerCase().includes('reference.html');
            
            if (!loggedIn) {
                if (isReferencePage) {
                    alert("Your session has ended. Redirecting to Enrollment...");
                    window.location.href = "index.html#auth";
                } else {
                    window.location.reload();
                }
            } else {
                // If logged in on another tab, reload non-reference pages to update UI session view
                if (!isReferencePage) {
                    window.location.reload();
                }
            }
        }
    });
})();


// Helper to sync progress checkpoint to Flask backend if online/served via HTTP
function syncProgressToBackend(checkpointId, checked) {
    const isBackendAvailable = window.location.protocol.startsWith('http');
    const email = localStorage.getItem('studentEmail');
    if (isBackendAvailable && email && checkpointId) {
        const apiBase = window.location.protocol.startsWith('http') ? '' : 'https://studenhub.pr';
        fetch(`${apiBase}/api/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                checkpoint_id: checkpointId,
                checked: checked
            })
        }).catch(err => console.warn("Could not sync progress to backend:", err));
    }
}

// tracker.js - Simple local storage progress tracker for students
document.addEventListener("DOMContentLoaded", function() {
    // 1. Find all progress checkboxes
    const checkboxes = document.querySelectorAll(".progress-check");
    
    // 2. Load saved states from localStorage
    checkboxes.forEach(function(checkbox) {
        const id = checkbox.getAttribute("id");
        if (id) {
            const savedState = localStorage.getItem(id);
            if (savedState === "true") {
                checkbox.checked = true;
            }
        }
    });

    // 3. Update the progress metrics on the current page
    updatePageProgress();

    // 4. Listen for changes on checkboxes
    checkboxes.forEach(function(checkbox) {
        checkbox.addEventListener("change", function() {
            const id = checkbox.getAttribute("id");
            if (id) {
                localStorage.setItem(id, checkbox.checked ? "true" : "false");
                syncProgressToBackend(id, checkbox.checked);
            }
            updatePageProgress();
        });
    });

    // Function to calculate and update progress stats
    function updatePageProgress() {
        const total = checkboxes.length;
        if (total === 0) {
            // If we are on index.html, update the overall syllabus table progress
            updateHomepageProgress();
            return;
        }

        let completed = 0;
        checkboxes.forEach(function(checkbox) {
            if (checkbox.checked) {
                completed++;
            }
        });

        const percent = Math.round((completed / total) * 100) || 0;
        
        // Find or create progress text element
        let progressContainer = document.getElementById("page-progress-container");
        if (progressContainer) {
            progressContainer.innerHTML = `
                <div class="subject-progress-box">
                    <strong>Subject Progress:</strong> ${completed} of ${total} tasks completed (${percent}%)
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${percent}%;"></div>
                    </div>
                </div>
            `;
        }
    }

    // Function specifically for index.html to show status of all subjects
    function updateHomepageProgress() {
        const subjects = [
            { id: "c", name: "C Programming", totalTasks: 4 },
            { id: "python", name: "Python", totalTasks: 4 },
            { id: "html", name: "HTML", totalTasks: 5 },
            { id: "css", name: "CSS", totalTasks: 4 },
            { id: "javascript", name: "JavaScript", totalTasks: 4 },
            { id: "java", name: "Java", totalTasks: 4 },
            { id: "sql", name: "SQL", totalTasks: 4 },
            { id: "dbms", name: "DBMS", totalTasks: 5 },
            { id: "os", name: "OS", totalTasks: 5 },
            { id: "cn", name: "CN", totalTasks: 5 },
            { id: "react", name: "React.js", totalTasks: 4 },
            { id: "postgresql", name: "PostgreSQL", totalTasks: 4 },
            { id: "dsa", name: "DSA", totalTasks: 4 }
        ];

        let totalSyllabusTasks = 0;
        let totalSyllabusCompleted = 0;

        subjects.forEach(function(subject) {
            let subjectCompleted = 0;
            // Check all tasks for this subject
            for (let i = 1; i <= subject.totalTasks; i++) {
                const taskId = `${subject.id}-task-${i}`;
                if (localStorage.getItem(taskId) === "true") {
                    subjectCompleted++;
                }
            }

            totalSyllabusTasks += subject.totalTasks;
            totalSyllabusCompleted += subjectCompleted;

            // Find cell in index.html with class progress-cell and id e.g. "html-status"
            const statusCell = document.getElementById(`${subject.id}-status`);
            if (statusCell) {
                const percent = Math.round((subjectCompleted / subject.totalTasks) * 100) || 0;
                if (percent === 100) {
                    statusCell.innerHTML = `<span class="status-text status-completed">✅ Completed</span>`;
                } else if (percent > 0) {
                    statusCell.innerHTML = `<span class="status-text status-progress">⏳ In Progress (${percent}%)</span>`;
                } else {
                    statusCell.innerHTML = `<span class="status-text status-notstarted">Pending</span>`;
                }
            }
        });

        const overallPercent = Math.round((totalSyllabusCompleted / totalSyllabusTasks) * 100) || 0;
        
        // Update simple dashboard numeric counters
        const dashOverallCompleted = document.getElementById("dash-completed-count");
        if (dashOverallCompleted) {
            dashOverallCompleted.innerText = totalSyllabusCompleted;
        }
        
        const dashOverallPercent = document.getElementById("dash-progress-percent");
        if (dashOverallPercent) {
            dashOverallPercent.innerText = `${overallPercent}%`;
        }

        const dashProgressBar = document.getElementById("dash-progress-bar-fill");
        if (dashProgressBar) {
            dashProgressBar.style.width = `${overallPercent}%`;
            dashProgressBar.innerText = `${overallPercent}%`;
        }

        const overallContainer = document.getElementById("overall-progress-container");
        if (overallContainer) {
            overallContainer.innerHTML = `
                <div class="notice-box analytics-box">
                    <h3>📊 Scholastic Progress Analytics</h3>
                    <p>You have completed <strong>${totalSyllabusCompleted}</strong> out of <strong>${totalSyllabusTasks}</strong> total learning tasks across all subjects.</p>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${overallPercent}%;">
                            ${overallPercent}%
                        </div>
                    </div>
                </div>
            `;
        }
    }

    // Expose updateHomepageProgress globally
    window.updateHomepageProgress = updateHomepageProgress;
    
    // Check local storage periodically for changes (keep in sync)
    setInterval(updateHomepageProgress, 1500);
});



// Simple client-side search utilities for home and references pages
(function() {
    function normalize(s) { return (s || '').toString().toLowerCase(); }

    function searchAndShowResults(query, resultsContainer) {
        const q = normalize(query).trim();
        if (!resultsContainer) return;
        resultsContainer.innerHTML = '';
        if (!q) {
            resultsContainer.classList.remove('active');
            return;
        }

        // Find matching anchors and headings
        const matches = [];
        document.querySelectorAll('a, h1, h2, h3, h4, p, li').forEach(function(el) {
            // Avoid matching headers, navigation links, and settings dropdowns to reduce clutter
            if (el.closest('nav') || el.closest('#site-settings-bar') || el.closest('.search-row') || el.closest('.search-results')) {
                return;
            }
            if (normalize(el.innerText).includes(q)) {
                let text = el.innerText.trim();
                let href = el.getAttribute('href') || null;
                if (text && text.length < 150 && !matches.some(m => m.text === text)) {
                    matches.push({text, href});
                }
            }
        });

        if (matches.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results-text">No results found.</div>';
            resultsContainer.classList.add('active');
            return;
        }

        const ul = document.createElement('ul');
        matches.slice(0, 10).forEach(function(m) {
            const li = document.createElement('li');
            if (m.href) {
                const a = document.createElement('a');
                a.href = m.href;
                a.target = '_blank';
                a.innerText = m.text;
                li.appendChild(a);
            } else {
                li.innerText = m.text;
            }
            ul.appendChild(li);
        });
        resultsContainer.appendChild(ul);
        resultsContainer.classList.add('active');
    }

    // Reference page: hide non-matching sections grouped by h3
    function filterReferenceSections(query) {
        const q = normalize(query).trim();
        const headings = document.querySelectorAll('h3');
        headings.forEach(function(h3) {
            // Collect group text (h3 + following siblings until next h3)
            let groupText = h3.innerText + ' ';
            let node = h3.nextElementSibling;
            while (node && node.tagName.toLowerCase() !== 'h3') {
                groupText += ' ' + node.innerText;
                node = node.nextElementSibling;
            }
            const matched = q === '' || normalize(groupText).includes(q);
            // show/hide h3 and its following nodes
            h3.style.display = matched ? '' : 'none';
            node = h3.nextElementSibling;
            while (node && node.tagName.toLowerCase() !== 'h3') {
                node.style.display = matched ? '' : 'none';
                node = node.nextElementSibling;
            }
        });
    }

    // Wire up inputs if present on page
    document.addEventListener('DOMContentLoaded', function() {
        const homeInput = document.getElementById('home-search');
        const homeBtn = document.getElementById('home-search-btn');
        const homeResults = document.getElementById('home-search-results');
        if (homeInput) {
            const handler = function() {
                searchAndShowResults(homeInput.value, homeResults);
            };
            homeInput.addEventListener('input', handler);
            if (homeBtn) homeBtn.addEventListener('click', handler);
        }

        const refInput = document.getElementById('ref-search');
        const refBtn = document.getElementById('ref-search-btn');
        const refResults = document.getElementById('ref-search-results');
        if (refInput) {
            const handlerRef = function() {
                // populate results and also filter sections
                searchAndShowResults(refInput.value, refResults);
                filterReferenceSections(refInput.value);
            };
            refInput.addEventListener('input', handlerRef);
            if (refBtn) refBtn.addEventListener('click', handlerRef);
        }
    });

    // Expose for debugging
    window.searchPage = function(q) {
        const r = document.getElementById('home-search-results') || document.getElementById('ref-search-results');
        searchAndShowResults(q, r);
        filterReferenceSections(q);
    };
})();
