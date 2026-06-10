(function() {
    'use strict';

    const canvas = document.getElementById('draftCanvas');
    const ctx = canvas.getContext('2d');
    const clearBtn = document.getElementById('clearCanvas');
    const undoBtn = document.getElementById('undoCanvas');
    const colorBtns = document.querySelectorAll('.color-btn');
    const brushSizeInput = document.getElementById('brushSize');

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentColor = '#e0e0e0';
    let currentSize = 3;
    let history = [];
    let historyIndex = -1;

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        restoreCanvas();
    }

    function saveState() {
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push(canvas.toDataURL());
        historyIndex++;
        if (history.length > 50) {
            history.shift();
            historyIndex--;
        }
        saveCanvasToStorage();
    }

    function restoreCanvas() {
        if (historyIndex >= 0 && history[historyIndex]) {
            const img = new Image();
            img.onload = function() {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = history[historyIndex];
        } else {
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    function saveCanvasToStorage() {
        const today = new Date().toDateString();
        localStorage.setItem('canvas_' + today, canvas.toDataURL());
        localStorage.setItem('canvasHistory_' + today, JSON.stringify(history));
        localStorage.setItem('canvasHistoryIndex_' + today, historyIndex);
    }

    function loadCanvasFromStorage() {
        const today = new Date().toDateString();
        const savedCanvas = localStorage.getItem('canvas_' + today);
        const savedHistory = localStorage.getItem('canvasHistory_' + today);
        const savedIndex = localStorage.getItem('canvasHistoryIndex_' + today);
        
        if (savedCanvas) {
            history = savedHistory ? JSON.parse(savedHistory) : [savedCanvas];
            historyIndex = savedIndex ? parseInt(savedIndex) : 0;
            const img = new Image();
            img.onload = function() {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = history[historyIndex];
        } else {
            saveState();
        }
    }

    function startDrawing(e) {
        isDrawing = true;
        const pos = getPosition(e);
        lastX = pos.x;
        lastY = pos.y;
    }

    function stopDrawing() {
        if (isDrawing) {
            isDrawing = false;
            saveState();
        }
    }

    function draw(e) {
        if (!isDrawing) return;
        
        e.preventDefault();
        const pos = getPosition(e);
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        
        lastX = pos.x;
        lastY = pos.y;
    }

    function getPosition(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        if (e.touches && e.touches.length > 0) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    function clearCanvas() {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveState();
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            const img = new Image();
            img.onload = function() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                saveCanvasToStorage();
            };
            img.src = history[historyIndex];
        }
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    clearBtn.addEventListener('click', clearCanvas);
    undoBtn.addEventListener('click', undo);

    colorBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            colorBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentColor = this.dataset.color;
        });
    });

    brushSizeInput.addEventListener('input', function() {
        currentSize = parseInt(this.value);
    });

    window.addEventListener('resize', resizeCanvas);

    document.addEventListener('DOMContentLoaded', function() {
        resizeCanvas();
        loadCanvasFromStorage();
    });

    window.CanvasManager = {
        clear: clearCanvas,
        undo: undo,
        reset: function() {
            history = [];
            historyIndex = -1;
            clearCanvas();
        }
    };
})();
