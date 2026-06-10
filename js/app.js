(function() {
    'use strict';

    const STORAGE_KEYS = {
        COMPLETED: 'puzzle_completed',
        THEME: 'puzzle_theme',
        HINTS_USED: 'puzzle_hints_used'
    };

    let currentPuzzle = null;
    let currentDate = null;
    let hintsRevealed = [];
    let isCompleted = false;

    const elements = {
        dateDisplay: document.getElementById('dateDisplay'),
        puzzleType: document.getElementById('puzzleType'),
        puzzleNumber: document.getElementById('puzzleNumber'),
        difficulty: document.getElementById('difficulty'),
        puzzleContent: document.getElementById('puzzleContent'),
        hintsContainer: document.getElementById('hintsContainer'),
        hintContent: document.getElementById('hintContent'),
        hintsUsed: document.getElementById('hintsUsed'),
        answerInput: document.getElementById('answerInput'),
        submitBtn: document.getElementById('submitBtn'),
        answerResult: document.getElementById('answerResult'),
        showAnswerBtn: document.getElementById('showAnswerBtn'),
        answerCollapsed: document.getElementById('answerCollapsed'),
        correctAnswer: document.getElementById('correctAnswer'),
        answerExplanation: document.getElementById('answerExplanation'),
        statsBtn: document.getElementById('statsBtn'),
        statsModal: document.getElementById('statsModal'),
        statsBody: document.getElementById('statsBody'),
        closeStats: document.getElementById('closeStats'),
        completedModal: document.getElementById('completedModal'),
        completedMessage: document.getElementById('completedMessage'),
        closeCompleted: document.getElementById('closeCompleted'),
        themeBtn: document.getElementById('themeBtn')
    };

    function getDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getFormattedDate(date) {
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        return date.toLocaleDateString('zh-CN', options);
    }

    function getPuzzleForDate(date) {
        const dateStr = getDateString(date);
        const seed = hashCode(dateStr);
        
        const types = ['logic', 'number', 'graphical'];
        const typeIndex = seed % 3;
        const puzzleType = types[typeIndex];
        
        const puzzles = PUZZLES[puzzleType];
        const puzzleIndex = Math.floor(seed / 3) % puzzles.length;
        
        const puzzle = puzzles[puzzleIndex];
        
        const dayOfYear = getDayOfYear(date);
        const puzzleNumber = dayOfYear;
        
        return { ...puzzle, puzzleNumber, date: dateStr };
    }

    function hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    function getDayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
    }

    function normalizeAnswer(answer) {
        return answer
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[，。！？、；：""''（）《》【】]/g, '')
            .replace(/[,!?;:""'()<>\[\]]/g, '');
    }

    function checkAnswer(userAnswer, correctAnswer) {
        const normalizedUser = normalizeAnswer(userAnswer);
        const normalizedCorrect = normalizeAnswer(correctAnswer);
        
        if (normalizedUser === normalizedCorrect) {
            return true;
        }
        
        const correctParts = correctAnswer.split(/[，,]/).map(p => normalizeAnswer(p));
        return correctParts.some(part => normalizedUser.includes(part));
    }

    function renderPuzzle(puzzle) {
        elements.puzzleType.textContent = PUZZLE_TYPE_NAMES[puzzle.type];
        elements.puzzleNumber.textContent = `第 ${puzzle.puzzleNumber} 题`;
        elements.difficulty.textContent = getDifficultyText(puzzle.difficulty);
        elements.difficulty.className = `difficulty ${puzzle.difficulty}`;
        
        let contentHTML = `<h2>${escapeHtml(puzzle.title)}</h2>`;
        
        const description = puzzle.description.replace(/\n/g, '<br>');
        contentHTML += `<p>${description}</p>`;
        
        if (puzzle.content) {
            if (puzzle.type === 'number' && puzzle.content.sequence) {
                contentHTML += '<div class="number-sequence">';
                puzzle.content.sequence.forEach(num => {
                    if (num === '?') {
                        contentHTML += `<div class="number-item blank">?</div>`;
                    } else {
                        contentHTML += `<div class="number-item">${num}</div>`;
                    }
                });
                contentHTML += '</div>';
            }
            
            if (puzzle.type === 'graphical' && puzzle.content.shapes) {
                contentHTML += '<div class="graphical-puzzle">';
                puzzle.content.shapes.forEach(row => {
                    contentHTML += '<div class="shape-row">';
                    row.forEach(shape => {
                        if (shape === '?') {
                            contentHTML += `<div class="shape question">?</div>`;
                        } else if (shape === '→' || shape === '+' || shape === '=' || shape === '缺右半边') {
                            contentHTML += `<span style="color: var(--text-muted); margin: 0 5px;">${shape}</span>`;
                        } else {
                            contentHTML += `<div class="shape">${shape}</div>`;
                        }
                    });
                    contentHTML += '</div>';
                });
                contentHTML += '</div>';
            }
        }
        
        elements.puzzleContent.innerHTML = contentHTML;
    }

    function getDifficultyText(difficulty) {
        const texts = {
            easy: '简单',
            medium: '中等',
            hard: '困难'
        };
        return texts[difficulty] || difficulty;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function initHints() {
        hintsRevealed = [];
        elements.hintContent.innerHTML = '';
        elements.hintContent.classList.remove('show');
        elements.hintsUsed.textContent = '0/3';
        
        const hintBtns = elements.hintsContainer.querySelectorAll('.hint-btn');
        hintBtns.forEach(btn => {
            btn.classList.remove('revealed');
            btn.disabled = false;
        });
        
        const savedHints = getHintsUsed(currentPuzzle.id);
        if (savedHints && savedHints.length > 0) {
            savedHints.forEach(level => {
                revealHint(level, true);
            });
        }
    }

    function revealHint(level, silent = false) {
        if (hintsRevealed.includes(level)) return;
        if (level > hintsRevealed.length + 1) return;
        
        hintsRevealed.push(level);
        
        const hintBtn = elements.hintsContainer.querySelector(`[data-level="${level}"]`);
        if (hintBtn) {
            hintBtn.classList.add('revealed');
            hintBtn.disabled = true;
        }
        
        elements.hintsUsed.textContent = `${hintsRevealed.length}/3`;
        
        if (!elements.hintContent.classList.contains('show')) {
            elements.hintContent.classList.add('show');
        }
        
        const hintHTML = `
            <div class="hint-item">
                <div class="hint-label">提示 ${level}</div>
                <div>${currentPuzzle.hints[level - 1]}</div>
            </div>
        `;
        elements.hintContent.insertAdjacentHTML('beforeend', hintHTML);
        
        if (!silent) {
            saveHintsUsed(currentPuzzle.id, hintsRevealed);
        }
    }

    function submitAnswer() {
        const userAnswer = elements.answerInput.value;
        if (!userAnswer.trim()) {
            showAnswerResult('请输入答案', false);
            return;
        }
        
        const isCorrect = checkAnswer(userAnswer, currentPuzzle.answer);
        
        if (isCorrect) {
            showAnswerResult('回答正确！🎉', true);
            if (!isCompleted) {
                markCompleted();
            }
            elements.submitBtn.disabled = true;
            elements.answerInput.disabled = true;
        } else {
            showAnswerResult('回答不正确，再想想...', false);
        }
    }

    function showAnswerResult(message, isCorrect) {
        elements.answerResult.textContent = message;
        elements.answerResult.className = `answer-result show ${isCorrect ? 'correct' : 'incorrect'}`;
    }

    function toggleAnswer() {
        elements.showAnswerBtn.classList.toggle('open');
        elements.answerCollapsed.classList.toggle('show');
        
        if (elements.answerCollapsed.classList.contains('show')) {
            elements.correctAnswer.innerHTML = `<strong>答案：</strong>${currentPuzzle.answer}`;
            elements.answerExplanation.innerHTML = `<strong>解析：</strong>${currentPuzzle.explanation.replace(/\n/g, '<br>')}`;
        }
    }

    function markCompleted() {
        isCompleted = true;
        saveCompleted(currentPuzzle.date, {
            puzzleId: currentPuzzle.id,
            type: currentPuzzle.type,
            title: currentPuzzle.title,
            completedAt: new Date().toISOString(),
            hintsUsed: hintsRevealed.length
        });
        
        const totalCompleted = getTotalCompleted();
        elements.completedMessage.textContent = `你已完成 ${totalCompleted} 道题目！`;
        
        setTimeout(() => {
            elements.completedModal.classList.add('show');
        }, 500);
    }

    function showStats() {
        const completed = getAllCompleted();
        const today = getDateString(new Date());
        
        let html = '';
        
        if (Object.keys(completed).length === 0) {
            html = '<div class="no-stats">还没有完成任何题目，开始今天的挑战吧！</div>';
        } else {
            const totalCompleted = Object.keys(completed).length;
            const currentStreak = calculateStreak(completed);
            const maxStreak = calculateMaxStreak(completed);
            
            html += `
                <div class="stats-summary">
                    <div class="stat-card">
                        <div class="stat-value">${totalCompleted}</div>
                        <div class="stat-label">总完成数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${currentStreak}</div>
                        <div class="stat-label">连续天数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${maxStreak}</div>
                        <div class="stat-label">最长连续</div>
                    </div>
                </div>
                <div class="stats-calendar">
                    <h3>本月通关日历</h3>
                    ${renderCalendar(completed)}
                </div>
            `;
        }
        
        elements.statsBody.innerHTML = html;
        elements.statsModal.classList.add('show');
    }

    function calculateStreak(completed) {
        let streak = 0;
        const today = new Date();
        const checkDate = new Date(today);
        
        while (true) {
            const dateStr = getDateString(checkDate);
            if (completed[dateStr]) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        return streak;
    }

    function calculateMaxStreak(completed) {
        const dates = Object.keys(completed).sort();
        if (dates.length === 0) return 0;
        
        let maxStreak = 1;
        let currentStreak = 1;
        
        for (let i = 1; i < dates.length; i++) {
            const prev = new Date(dates[i - 1]);
            const curr = new Date(dates[i]);
            const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
            
            if (diffDays === 1) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
        }
        
        return maxStreak;
    }

    function renderCalendar(completed) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const today = getDateString(now);
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        
        let html = '<div class="calendar-grid">';
        
        const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
        weekDays.forEach(day => {
            html += `<div class="calendar-day" style="font-weight: bold;">${day}</div>`;
        });
        
        for (let i = 0; i < startDayOfWeek; i++) {
            html += '<div class="calendar-day"></div>';
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = getDateString(new Date(year, month, day));
            const isCompleted = !!completed[dateStr];
            const isToday = dateStr === today;
            
            let classes = 'calendar-day';
            if (isCompleted) classes += ' completed';
            if (isToday) classes += ' today';
            
            html += `<div class="${classes}">${day}</div>`;
        }
        
        html += '</div>';
        return html;
    }

    function saveCompleted(date, data) {
        const completed = getAllCompleted();
        completed[date] = data;
        localStorage.setItem(STORAGE_KEYS.COMPLETED, JSON.stringify(completed));
    }

    function getAllCompleted() {
        const data = localStorage.getItem(STORAGE_KEYS.COMPLETED);
        return data ? JSON.parse(data) : {};
    }

    function getTotalCompleted() {
        return Object.keys(getAllCompleted()).length;
    }

    function isDateCompleted(dateStr) {
        const completed = getAllCompleted();
        return !!completed[dateStr];
    }

    function saveHintsUsed(puzzleId, hints) {
        const allHints = getHintsUsedAll();
        allHints[puzzleId] = hints;
        localStorage.setItem(STORAGE_KEYS.HINTS_USED, JSON.stringify(allHints));
    }

    function getHintsUsed(puzzleId) {
        const allHints = getHintsUsedAll();
        return allHints[puzzleId] || [];
    }

    function getHintsUsedAll() {
        const data = localStorage.getItem(STORAGE_KEYS.HINTS_USED);
        return data ? JSON.parse(data) : {};
    }

    function toggleTheme() {
        document.body.classList.toggle('dark-mode');
        document.body.classList.toggle('light-mode');
        
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
        
        if (window.CanvasManager) {
            setTimeout(() => {
                window.CanvasManager.clear();
            }, 100);
        }
    }

    function initTheme() {
        const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
        if (savedTheme === 'light') {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
        }
    }

    function init() {
        currentDate = new Date();
        elements.dateDisplay.textContent = getFormattedDate(currentDate);
        
        currentPuzzle = getPuzzleForDate(currentDate);
        
        renderPuzzle(currentPuzzle);
        initHints();
        
        isCompleted = isDateCompleted(currentPuzzle.date);
        if (isCompleted) {
            elements.submitBtn.disabled = true;
            elements.answerInput.disabled = true;
            showAnswerResult('今日已完成 ✓', true);
        }
        
        elements.hintsContainer.addEventListener('click', function(e) {
            if (e.target.classList.contains('hint-btn')) {
                const level = parseInt(e.target.dataset.level);
                revealHint(level);
            }
        });
        
        elements.submitBtn.addEventListener('click', submitAnswer);
        
        elements.answerInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                submitAnswer();
            }
        });
        
        elements.showAnswerBtn.addEventListener('click', toggleAnswer);
        
        elements.statsBtn.addEventListener('click', showStats);
        elements.closeStats.addEventListener('click', function() {
            elements.statsModal.classList.remove('show');
        });
        
        elements.closeCompleted.addEventListener('click', function() {
            elements.completedModal.classList.remove('show');
        });
        
        elements.themeBtn.addEventListener('click', toggleTheme);
        
        elements.statsModal.addEventListener('click', function(e) {
            if (e.target === elements.statsModal) {
                elements.statsModal.classList.remove('show');
            }
        });
        
        initTheme();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
