(function() {
    'use strict';

    const STORAGE_KEYS = {
        COMPLETED: 'puzzle_completed',
        THEME: 'puzzle_theme',
        HINTS_USED: 'puzzle_hints_used',
        LEADERBOARD: 'puzzle_leaderboard',
        START_TIME: 'puzzle_start_time'
    };

    let currentPuzzle = null;
    let currentDate = null;
    let hintsRevealed = [];
    let isCompleted = false;
    let timerInterval = null;
    let startTime = null;
    let elapsedTime = 0;

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
        themeBtn: document.getElementById('themeBtn'),
        graphicalChooser: document.getElementById('graphicalChooser'),
        answerSection: document.querySelector('.answer-section'),
        timerDisplay: document.getElementById('timerDisplay'),
        leaderboardBody: document.getElementById('leaderboardBody'),
        tabBtns: document.querySelectorAll('.tab-btn'),
        tabPanes: document.querySelectorAll('.tab-pane')
    };

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function startTimer() {
        if (timerInterval) return;
        
        const savedStartTime = localStorage.getItem(STORAGE_KEYS.START_TIME);
        if (savedStartTime && !isCompleted) {
            startTime = parseInt(savedStartTime);
            elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        } else if (!isCompleted) {
            startTime = Date.now();
            localStorage.setItem(STORAGE_KEYS.START_TIME, startTime.toString());
            elapsedTime = 0;
        }
        
        updateTimerDisplay();
        
        timerInterval = setInterval(() => {
            if (!isCompleted) {
                elapsedTime = Math.floor((Date.now() - startTime) / 1000);
                updateTimerDisplay();
            }
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function updateTimerDisplay() {
        if (elements.timerDisplay) {
            elements.timerDisplay.textContent = formatTime(elapsedTime);
        }
    }

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

    function extractGraphicalOptions(puzzle) {
        const options = new Set();
        const specialChars = ['→', '+', '=', '?', '缺右半边'];
        
        if (puzzle.content && puzzle.content.shapes) {
            puzzle.content.shapes.forEach(row => {
                row.forEach(shape => {
                    if (!specialChars.includes(shape) && shape.trim() !== '') {
                        options.add(shape);
                    }
                });
            });
        }
        
        const commonShapes = [
            '□', '○', '△', '●', '■', '▽', '♢', '◉',
            '↑', '↓', '←', '→',
            '☺', '☹',
            '·', '··', '···', '····', '·····',
            '一', '二', '三', '四', '五',
            '◐', '◑', '◒', '◓',
            '▌', '▐', '▄', '▀',
            '▨', '▩', '◫', '◧', '◨', '◩', '◪',
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'
        ];
        
        commonShapes.forEach(shape => options.add(shape));
        
        return Array.from(options);
    }
    
    function renderGraphicalChooser(puzzle) {
        if (!elements.graphicalChooser) return;
        
        if (puzzle.type !== 'graphical') {
            elements.graphicalChooser.style.display = 'none';
            return;
        }
        
        const options = extractGraphicalOptions(puzzle);
        
        let html = '<div class="graphical-chooser-header"><span>点击选择答案：</span><button type="button" class="clear-choice-btn" id="clearChoiceBtn">清除</button></div>';
        html += '<div class="graphical-options">';
        
        options.forEach(opt => {
            html += `<button type="button" class="graphical-option" data-value="${opt}">${opt}</button>`;
        });
        
        html += '</div>';
        elements.graphicalChooser.innerHTML = html;
        elements.graphicalChooser.style.display = 'block';
        
        const optionBtns = elements.graphicalChooser.querySelectorAll('.graphical-option');
        optionBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const value = this.dataset.value;
                const currentValue = elements.answerInput.value;
                if (currentValue === value) {
                    elements.answerInput.value = '';
                    optionBtns.forEach(b => b.classList.remove('selected'));
                } else {
                    elements.answerInput.value = value;
                    optionBtns.forEach(b => b.classList.remove('selected'));
                    this.classList.add('selected');
                }
                elements.answerInput.focus();
            });
        });
        
        const clearBtn = elements.graphicalChooser.querySelector('#clearChoiceBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                elements.answerInput.value = '';
                optionBtns.forEach(b => b.classList.remove('selected'));
            });
        }
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
        
        renderGraphicalChooser(puzzle);
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
            disableGraphicalChooser();
        } else {
            showAnswerResult('回答不正确，再想想...', false);
        }
    }
    
    function disableGraphicalChooser() {
        if (!elements.graphicalChooser) return;
        const optionBtns = elements.graphicalChooser.querySelectorAll('.graphical-option');
        optionBtns.forEach(btn => {
            btn.disabled = true;
        });
        const clearBtn = elements.graphicalChooser.querySelector('#clearChoiceBtn');
        if (clearBtn) {
            clearBtn.disabled = true;
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
        stopTimer();
        localStorage.removeItem(STORAGE_KEYS.START_TIME);
        
        const completionData = {
            puzzleId: currentPuzzle.id,
            type: currentPuzzle.type,
            title: currentPuzzle.title,
            completedAt: new Date().toISOString(),
            hintsUsed: hintsRevealed.length,
            timeUsed: elapsedTime
        };
        
        saveCompleted(currentPuzzle.date, completionData);
        addToLeaderboard(completionData);
        
        const totalCompleted = getTotalCompleted();
        const timeStr = formatTime(elapsedTime);
        elements.completedMessage.textContent = `用时 ${timeStr}，提示 ${hintsRevealed.length} 次\n你已完成 ${totalCompleted} 道题目！`;
        
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

    function generateMockNames() {
        const surnames = ['张', '李', '王', '刘', '陈', '杨', '黄', '赵', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗'];
        const names = ['明', '华', '强', '磊', '军', '洋', '勇', '彬', '杰', '涛', '敏', '静', '丽', '芳', '燕', '玲', '桂', '娣', '秀', '英'];
        const result = [];
        for (let i = 0; i < 20; i++) {
            const s = surnames[Math.floor(Math.random() * surnames.length)];
            const n = names[Math.floor(Math.random() * names.length)];
            result.push(s + n);
        }
        return result;
    }

    function getLeaderboard() {
        const data = localStorage.getItem(STORAGE_KEYS.LEADERBOARD);
        let leaderboard = data ? JSON.parse(data) : [];
        
        const today = getDateString(new Date());
        leaderboard = leaderboard.filter(item => {
            const itemDate = new Date(item.completedAt).toISOString().split('T')[0];
            return itemDate === today;
        });
        
        if (leaderboard.length === 0) {
            const mockNames = generateMockNames();
            const types = ['logic', 'number', 'graphical'];
            for (let i = 0; i < 15; i++) {
                const baseTime = 30 + i * 15 + Math.floor(Math.random() * 30);
                const hintsUsed = Math.floor(Math.random() * 4);
                leaderboard.push({
                    id: `mock_${i}`,
                    name: mockNames[i % mockNames.length],
                    type: types[Math.floor(Math.random() * 3)],
                    completedAt: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
                    hintsUsed: hintsUsed,
                    timeUsed: baseTime + hintsUsed * 60,
                    isMock: true
                });
            }
            saveLeaderboard(leaderboard);
        }
        
        return leaderboard;
    }

    function saveLeaderboard(leaderboard) {
        localStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(leaderboard));
    }

    function addToLeaderboard(completionData) {
        const leaderboard = getLeaderboard();
        const today = getDateString(new Date());
        
        const existingIndex = leaderboard.findIndex(item => !item.isMock && item.name === '我');
        if (existingIndex >= 0) {
            leaderboard.splice(existingIndex, 1);
        }
        
        leaderboard.push({
            id: `user_${Date.now()}`,
            name: '我',
            type: completionData.type,
            completedAt: completionData.completedAt,
            hintsUsed: completionData.hintsUsed,
            timeUsed: completionData.timeUsed,
            isMock: false
        });
        
        leaderboard.sort((a, b) => {
            if (a.hintsUsed !== b.hintsUsed) {
                return a.hintsUsed - b.hintsUsed;
            }
            return a.timeUsed - b.timeUsed;
        });
        
        saveLeaderboard(leaderboard);
    }

    function sortLeaderboard(leaderboard) {
        return [...leaderboard].sort((a, b) => {
            if (a.hintsUsed !== b.hintsUsed) {
                return a.hintsUsed - b.hintsUsed;
            }
            return a.timeUsed - b.timeUsed;
        });
    }

    function showLeaderboard() {
        const leaderboard = sortLeaderboard(getLeaderboard());
        
        let html = '<div class="leaderboard-header"><h3>今日排行榜</h3><p class="leaderboard-tip">按提示数+用时综合排名</p></div>';
        
        if (leaderboard.length === 0) {
            html += '<div class="no-stats">今日暂无排行数据</div>';
        } else {
            html += '<div class="leaderboard-list">';
            
            const topThree = leaderboard.slice(0, 3);
            const rest = leaderboard.slice(3);
            
            if (topThree.length > 0) {
                html += '<div class="podium">';
                const medals = ['gold', 'silver', 'bronze'];
                const ranks = [1, 2, 3];
                
                if (topThree[1]) {
                    html += renderPodiumItem(topThree[1], medals[1], ranks[1]);
                }
                if (topThree[0]) {
                    html += renderPodiumItem(topThree[0], medals[0], ranks[0]);
                }
                if (topThree[2]) {
                    html += renderPodiumItem(topThree[2], medals[2], ranks[2]);
                }
                html += '</div>';
            }
            
            if (rest.length > 0) {
                html += '<div class="leaderboard-rest">';
                rest.forEach((item, index) => {
                    html += renderLeaderboardItem(item, index + 4);
                });
                html += '</div>';
            }
            
            html += '</div>';
        }
        
        elements.leaderboardBody.innerHTML = html;
    }

    function renderPodiumItem(item, medal, rank) {
        const timeStr = formatTime(item.timeUsed);
        const isMe = item.name === '我' && !item.isMock;
        const typeName = PUZZLE_TYPE_NAMES[item.type] || item.type;
        
        return `
            <div class="podium-item ${medal} ${isMe ? 'is-me' : ''}">
                <div class="podium-medal">
                    <span class="medal-icon">${medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : '🥉'}</span>
                    <span class="rank-number">${rank}</span>
                </div>
                <div class="podium-name">${item.name}${isMe ? ' (我)' : ''}</div>
                <div class="podium-stats">
                    <div class="podium-time">${timeStr}</div>
                    <div class="podium-hints">提示 ${item.hintsUsed} 次</div>
                    <div class="podium-type">${typeName}</div>
                </div>
            </div>
        `;
    }

    function renderLeaderboardItem(item, rank) {
        const timeStr = formatTime(item.timeUsed);
        const isMe = item.name === '我' && !item.isMock;
        const typeName = PUZZLE_TYPE_NAMES[item.type] || item.type;
        
        return `
            <div class="leaderboard-item ${isMe ? 'is-me' : ''}">
                <div class="lb-rank">${rank}</div>
                <div class="lb-name">${item.name}${isMe ? ' (我)' : ''}</div>
                <div class="lb-type">${typeName}</div>
                <div class="lb-hints">${item.hintsUsed}次</div>
                <div class="lb-time">${timeStr}</div>
            </div>
        `;
    }

    function initTabs() {
        elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const tab = this.dataset.tab;
                
                elements.tabBtns.forEach(b => b.classList.remove('active'));
                elements.tabPanes.forEach(p => p.classList.remove('active'));
                
                this.classList.add('active');
                document.getElementById(`tab-${tab}`).classList.add('active');
                
                if (tab === 'leaderboard') {
                    showLeaderboard();
                }
            });
        });
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
            setTimeout(disableGraphicalChooser, 100);
            
            const completedData = getAllCompleted()[currentPuzzle.date];
            if (completedData && completedData.timeUsed) {
                elapsedTime = completedData.timeUsed;
                updateTimerDisplay();
            }
        } else {
            startTimer();
        }
        
        initTabs();
        
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
