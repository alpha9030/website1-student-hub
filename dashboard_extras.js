/**
 * StudentHub Dashboard Extras Orchestrator
 * Handles the Pomodoro focus timer, milestone goals checklists, and animated SVG progress circles.
 */

(sidebarInit = function() {
    // 1. Pomodoro Focus Timer State
    let pomodoroDurationMinutes = 25; // default
    let pomodoroTimeRemaining = pomodoroDurationMinutes * 60;
    let pomodoroInterval = null;
    let pomodoroIsRunning = false;

    window.changePomodoroDuration = function(val) {
        const mins = parseInt(val);
        if (isNaN(mins) || mins <= 0) return;
        
        pomodoroDurationMinutes = mins;
        if (!pomodoroIsRunning) {
            pomodoroTimeRemaining = pomodoroDurationMinutes * 60;
            updatePomodoroDisplay();
        }
    };

    window.togglePomodoro = function() {
        const startBtn = document.getElementById('pomodoro-start-btn');
        if (pomodoroIsRunning) {
            // Pause timer loop
            clearInterval(pomodoroInterval);
            pomodoroIsRunning = false;
            if (startBtn) startBtn.textContent = 'Start';
        } else {
            // Start timer loop
            pomodoroIsRunning = true;
            if (startBtn) startBtn.textContent = 'Pause';
            pomodoroInterval = setInterval(() => {
                pomodoroTimeRemaining--;
                updatePomodoroDisplay();

                if (pomodoroTimeRemaining <= 0) {
                    clearInterval(pomodoroInterval);
                    pomodoroIsRunning = false;
                    if (startBtn) startBtn.textContent = 'Start';
                    pomodoroTimeRemaining = pomodoroDurationMinutes * 60; // reset to custom value
                    updatePomodoroDisplay();
                    alert("⏱️ Focus Session Complete! Time for a short break.");
                }
            }, 1000);
        }
    };

    window.resetPomodoro = function() {
        clearInterval(pomodoroInterval);
        pomodoroIsRunning = false;
        pomodoroTimeRemaining = pomodoroDurationMinutes * 60;
        updatePomodoroDisplay();
        const startBtn = document.getElementById('pomodoro-start-btn');
        if (startBtn) startBtn.textContent = 'Start';
    };

    function updatePomodoroDisplay() {
        const displayCard = document.getElementById('pomodoro-timer-display');
        const minutes = Math.floor(pomodoroTimeRemaining / 60);
        const seconds = pomodoroTimeRemaining % 60;
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (displayCard) displayCard.textContent = timeStr;
    }

    // 2. Personal Milestones Checklist
    let milestones = [];

    window.loadMilestones = function() {
        const suffix = localStorage.getItem('studentEmail') ? '_' + localStorage.getItem('studentEmail').replace(/[^a-zA-Z0-9]/g, '') : '_guest';
        let stored = [];
        try {
            stored = JSON.parse(localStorage.getItem('student_milestones' + suffix) || '[]');
        } catch(e) {
            stored = [];
        }
        milestones = stored;
        
        // Add defaults if empty
        if (milestones.length === 0) {
            milestones = [
                { id: 1, text: "Read DSA Study Guide checklist", completed: false },
                { id: 2, text: "Complete one Practice Quiz", completed: false },
                { id: 3, text: "Complete Student Profile configuration", completed: false }
            ];
            saveMilestones();
        }
        renderMilestones();
    };

    function saveMilestones() {
        const suffix = localStorage.getItem('studentEmail') ? '_' + localStorage.getItem('studentEmail').replace(/[^a-zA-Z0-9]/g, '') : '_guest';
        localStorage.setItem('student_milestones' + suffix, JSON.stringify(milestones));
    }

    window.addPersonalMilestone = function() {
        const input = document.getElementById('new-milestone-input');
        const text = input.value.trim();
        if (!text) return;

        milestones.push({
            id: Date.now(),
            text: text,
            completed: false
        });
        input.value = '';
        saveMilestones();
        renderMilestones();
    };

    window.toggleMilestone = function(id) {
        const milestone = milestones.find(m => m.id === id);
        if (milestone) {
            milestone.completed = !milestone.completed;
            saveMilestones();
            renderMilestones();
        }
    };

    window.deleteMilestone = function(id) {
        milestones = milestones.filter(m => m.id !== id);
        saveMilestones();
        renderMilestones();
    };

    function renderMilestones() {
        const container = document.getElementById('milestones-checklist-container');
        if (!container) return;
        container.innerHTML = '';

        let completedCount = 0;
        milestones.forEach(m => {
            if (m.completed) completedCount++;

            const item = document.createElement('div');
            item.className = 'checklist-item';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.justifyContent = 'space-between';
            item.style.fontSize = '13px';
            item.style.padding = '6px 0';
            item.style.borderBottom = '1px solid var(--border-color)';

            const leftPart = document.createElement('div');
            leftPart.style.display = 'flex';
            leftPart.style.alignItems = 'center';
            leftPart.style.gap = '8px';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = m.completed;
            chk.style.accentColor = 'var(--primary-color)';
            chk.style.cursor = 'pointer';
            chk.style.width = '14px';
            chk.style.height = '14px';
            chk.addEventListener('change', () => toggleMilestone(m.id));

            const lbl = document.createElement('label');
            lbl.textContent = m.text;
            lbl.style.cursor = 'pointer';
            lbl.style.color = 'var(--text-body)';
            if (m.completed) {
                lbl.style.textDecoration = 'line-through';
                lbl.style.color = 'var(--text-muted)';
            }

            leftPart.appendChild(chk);
            leftPart.appendChild(lbl);

            const delBtn = document.createElement('button');
            delBtn.innerHTML = '&times;';
            delBtn.style.background = 'transparent';
            delBtn.style.border = 'none';
            delBtn.style.color = '#ef4444';
            delBtn.style.cursor = 'pointer';
            delBtn.style.fontSize = '16px';
            delBtn.style.padding = '0 6px';
            delBtn.addEventListener('click', () => deleteMilestone(m.id));

            item.appendChild(leftPart);
            item.appendChild(delBtn);
            container.appendChild(item);
        });

        const totalSpan = document.getElementById('milestone-completed-count');
        if (totalSpan) {
            totalSpan.textContent = `${completedCount}/${milestones.length}`;
        }
    }

    // 3. Overall progress animated SVG circle sync
    window.syncAnimatedCircle = function() {
        const textElem = document.getElementById('dash-progress-percent');
        const circle = document.getElementById('dash-progress-circle');
        if (!circle || !textElem) return;

        const match = textElem.textContent.match(/(\d+)%/);
        if (match) {
            const percent = parseInt(match[1]);
            // Circumference = 2 * Math.PI * r = 2 * 3.14159 * 22 = 138.2
            const offset = 138.2 - (percent / 100) * 138.2;
            circle.style.strokeDashoffset = offset;
        }
    };

    // Initialize on page startup
    window.addEventListener('DOMContentLoaded', () => {
        window.loadMilestones();
        setInterval(window.syncAnimatedCircle, 1000); // Poll and sync animated indicator
    });

    // Re-initialize on view transitions
    const originalShowView2 = window.showView;
    window.showView = function(viewId) {
        if (originalShowView2) originalShowView2(viewId);
        if (viewId === 'dashboard') {
            setTimeout(() => {
                window.loadMilestones();
                window.syncAnimatedCircle();
            }, 100);
        }
    };
})();
