document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const canvas = document.getElementById('timer-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Support PiP on High DPI screens and larger layouts
    const CANVAS_SIZE = 800; // Physical resolution scaled up
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    
    const timeDisplay = document.getElementById('time-display');
    const inputHrs = document.getElementById('input-hrs');
    const inputMin = document.getElementById('input-min');
    const inputSec = document.getElementById('input-sec');
    
    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    const btnReset = document.getElementById('btn-reset');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnExitFullscreen = document.getElementById('btn-exit-fullscreen');
    const btnPip = document.getElementById('btn-pip');
    const btnTheme = document.getElementById('btn-theme');
    
    const pipVideo = document.getElementById('pip-video');
    const fullscreenWrapper = document.getElementById('fullscreen-wrapper');

    // Timer State
    let totalDurationMs = 0;
    let timeRemainingMs = 0;
    let isRunning = false;
    let lastTime = 0;
    let rafId = null;

    // PiP Setup: Stream Canvas to Video
    try {
        const stream = canvas.captureStream(30); // 30 FPS stream
        pipVideo.srcObject = stream;
        
        // This is necessary to play standard video objects on mobile/some browsers,
        // though autoplay + muted is often enough. We make sure it's loaded.
        pipVideo.addEventListener('loadedmetadata', () => {
            pipVideo.play().catch(e => console.error('Video autoplay prevented', e));
        });
    } catch (e) {
        console.warn('Canvas captureStream not supported in this browser.', e);
        btnPip.style.display = 'none';
    }

    function formatTimeDisplay(ms) {
        if (ms < 0) ms = 0;
        const totalSeconds = Math.ceil(ms / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        
        if (h > 0) {
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function updateInputs() {
        if (timeRemainingMs <= 0 && !isRunning) {
            inputHrs.value = '0';
            inputMin.value = '0';
            inputSec.value = '0';
            return;
        }
        
        const totalSeconds = Math.ceil(timeRemainingMs / 1000);
        inputHrs.value = Math.floor(totalSeconds / 3600);
        inputMin.value = Math.floor((totalSeconds % 3600) / 60);
        inputSec.value = totalSeconds % 60;
    }

    function getInputsDuration() {
        const h = parseInt(inputHrs.value) || 0;
        const m = parseInt(inputMin.value) || 0;
        const s = parseInt(inputSec.value) || 0;
        return ((h * 3600) + (m * 60) + s) * 1000;
    }

    function drawTimer(msRemaining, msTotal) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = Math.min(cx, cy) - 10;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Calculate progress (from 1 to 0)
        let progress = msTotal > 0 ? msRemaining / msTotal : 0;
        progress = Math.max(0, Math.min(1, progress));
        const isDark = document.body.classList.contains('dark-theme');
        
        // Fill the canvas with a solid color to prevent the PiP video from defaulting to black for transparent pixels
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg-gradient-start').trim() || (isDark ? '#14181f' : '#f5f5f5');
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Background track (dark circle)
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
        ctx.fill();

        // Shrinking red disk (sweeping action)
        if (progress > 0) {
            const startAngle = -Math.PI / 2; // Start from top
            const endAngle = startAngle + (Math.PI * 2 * progress);
            
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--primary-red') || 'hsl(348, 100%, 61%)';
            ctx.fill();
        }
        
        // Update DOM display separately for UI crispness
        timeDisplay.innerText = formatTimeDisplay(msRemaining);
    }

    function loop(now) {
        if (!isRunning) return;
        
        const delta = now - lastTime;
        lastTime = now;
        
        timeRemainingMs -= delta;
        
        if (timeRemainingMs <= 0) {
            timeRemainingMs = 0;
            isRunning = false;
            updateButtons();
            updateInputs();
        }
        
        drawTimer(timeRemainingMs, totalDurationMs);
        
        if (isRunning) {
            rafId = requestAnimationFrame(loop);
        }
    }

    function updateButtons() {
        if (isRunning) {
            btnStart.disabled = true;
            btnStart.innerText = 'Running...';
            btnPause.disabled = false;
        } else {
            btnStart.disabled = false;
            btnStart.innerText = 'Start';
            btnPause.disabled = true;
        }
    }

    // Handlers
    btnStart.addEventListener('click', () => {
        if (!isRunning) {
            if (timeRemainingMs <= 0) {
                totalDurationMs = getInputsDuration();
                timeRemainingMs = totalDurationMs;
            }
            
            // if input is changed while paused or stopped
            const currentInputs = getInputsDuration();
            if (Math.abs(currentInputs - timeRemainingMs) > 1000) {
                // If user modified inputs manually
                totalDurationMs = currentInputs;
                timeRemainingMs = totalDurationMs;
            }
            
            if (timeRemainingMs > 0) {
                isRunning = true;
                lastTime = performance.now();
                rafId = requestAnimationFrame(loop);
                
                // Play video stream
                pipVideo.play().catch(() => {});
            }
        }
        updateButtons();
    });

    btnPause.addEventListener('click', () => {
        isRunning = false;
        cancelAnimationFrame(rafId);
        updateButtons();
        updateInputs();
    });

    btnReset.addEventListener('click', () => {
        isRunning = false;
        cancelAnimationFrame(rafId);
        timeRemainingMs = getInputsDuration();
        totalDurationMs = timeRemainingMs;
        drawTimer(timeRemainingMs, totalDurationMs);
        updateButtons();
    });

    // Manage Fullscreen state for CSS
    function handleFullscreenChange() {
        const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
        document.body.classList.toggle('is-fullscreen', isFull);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    // Fullscreen Handler
    btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (fullscreenWrapper.requestFullscreen) {
                fullscreenWrapper.requestFullscreen().catch(err => {
                    console.error(`Fullscreen element error: ${err.message}`);
                });
            } else if (fullscreenWrapper.webkitRequestFullscreen) {
                fullscreenWrapper.webkitRequestFullscreen();
            } else if (fullscreenWrapper.webkitRequestFullScreen) {
                fullscreenWrapper.webkitRequestFullScreen();
            } else if (fullscreenWrapper.mozRequestFullScreen) {
                fullscreenWrapper.mozRequestFullScreen();
            }
        }
    });

    btnExitFullscreen.addEventListener('click', () => {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.webkitCancelFullScreen) {
                document.webkitCancelFullScreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            }
        }
    });

    // Theme Handler
    btnTheme.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        drawTimer(timeRemainingMs, totalDurationMs);
    });

    // PiP Handler
    btnPip.addEventListener('click', async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                // Need to ensure the video isn't paused before PiP
                await pipVideo.play();
                await pipVideo.requestPictureInPicture();
            }
        } catch (error) {
            console.error('Failed to trigger PiP:', error);
            alert('Picture-in-Picture failed or is not supported in your browser.');
        }
    });

    // Handle inputs changes to intuitively update visuals if paused
    [inputHrs, inputMin, inputSec].forEach(input => {
        input.addEventListener('change', () => {
            if (!isRunning) {
                timeRemainingMs = getInputsDuration();
                totalDurationMs = timeRemainingMs;
                drawTimer(timeRemainingMs, totalDurationMs);
            }
        });
    });

    // Initial draw
    timeRemainingMs = getInputsDuration();
    totalDurationMs = timeRemainingMs;
    drawTimer(timeRemainingMs, totalDurationMs);
    updateButtons();
});
