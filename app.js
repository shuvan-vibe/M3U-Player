document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('videoElement');
    const streamUrlInput = document.getElementById('streamUrl');
    const loadBtn = document.getElementById('loadBtn');
    
    // Controls
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playIcon = document.getElementById('playIcon');
    const muteBtn = document.getElementById('muteBtn');
    const volumeIcon = document.getElementById('volumeIcon');
    const volumeSlider = document.getElementById('volumeSlider');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    
    const progressBarContainer = document.getElementById('progressBarContainer');
    const progressBar = document.getElementById('progressBar');
    const currentTimeDisplay = document.getElementById('currentTime');
    const durationDisplay = document.getElementById('duration');
    
    const qualityBtn = document.getElementById('qualityBtn');
    const qualityMenu = document.getElementById('qualityMenu');
    const currentQualityDisplay = document.getElementById('currentQualityDisplay');
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    const controlsContainer = document.getElementById('controlsContainer');
    const videoContainer = document.getElementById('videoContainer');

    let hls = null;
    let controlsTimeout;

    // --- Helper Functions ---
    const formatTime = (seconds) => {
        if (isNaN(seconds)) return "00:00";
        const date = new Date(seconds * 1000);
        const hh = date.getUTCHours();
        const mm = date.getUTCMinutes();
        const ss = date.getUTCSeconds().toString().padStart(2, '0');
        if (hh) {
            return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
        }
        return `${mm.toString().padStart(2, '0')}:${ss}`;
    };

    const showControls = () => {
        controlsContainer.classList.add('active');
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            if (!video.paused) {
                controlsContainer.classList.remove('active');
            }
        }, 3000);
    };

    const togglePlay = () => {
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    };

    const toggleMute = () => {
        video.muted = !video.muted;
        updateVolumeUI();
    };

    const updateVolumeUI = () => {
        if (video.muted || video.volume === 0) {
            volumeIcon.className = 'fa-solid fa-volume-xmark';
            volumeSlider.value = 0;
        } else if (video.volume < 0.5) {
            volumeIcon.className = 'fa-solid fa-volume-low';
            volumeSlider.value = video.volume;
        } else {
            volumeIcon.className = 'fa-solid fa-volume-high';
            volumeSlider.value = video.volume;
        }
    };

    // --- Video Event Listeners ---
    video.addEventListener('play', () => {
        playIcon.className = 'fa-solid fa-pause';
        showControls();
    });

    video.addEventListener('pause', () => {
        playIcon.className = 'fa-solid fa-play';
        showControls();
    });

    video.addEventListener('timeupdate', () => {
        const current = video.currentTime;
        const duration = video.duration;
        currentTimeDisplay.textContent = formatTime(current);
        
        if (duration) {
            const progressPercent = (current / duration) * 100;
            progressBar.style.width = `${progressPercent}%`;
            durationDisplay.textContent = formatTime(duration);
        }
    });

    video.addEventListener('waiting', () => {
        loadingOverlay.classList.add('active');
    });

    video.addEventListener('playing', () => {
        loadingOverlay.classList.remove('active');
    });

    videoContainer.addEventListener('mousemove', showControls);
    videoContainer.addEventListener('mouseleave', () => {
        if (!video.paused) {
            controlsContainer.classList.remove('active');
        }
    });

    // --- Control Event Listeners ---
    playPauseBtn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);
    
    muteBtn.addEventListener('click', toggleMute);
    
    volumeSlider.addEventListener('input', (e) => {
        video.volume = e.target.value;
        video.muted = e.target.value === '0';
        updateVolumeUI();
    });

    progressBarContainer.addEventListener('click', (e) => {
        const rect = progressBarContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        if (video.duration) {
            video.currentTime = pos * video.duration;
        }
    });

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            videoContainer.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            fullscreenIcon.className = 'fa-solid fa-compress';
        } else {
            fullscreenIcon.className = 'fa-solid fa-expand';
        }
    });

    // --- Quality Menu Logic ---
    qualityBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        qualityMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        qualityMenu.classList.remove('show');
    });

    const populateQualityMenu = (levels) => {
        // Keep only Auto option
        qualityMenu.innerHTML = '<div class="quality-option active" data-level="-1">Auto</div>';
        
        // Add specific levels
        levels.forEach((level, index) => {
            const height = level.height || 'Unknown';
            const option = document.createElement('div');
            option.className = 'quality-option';
            option.dataset.level = index;
            option.textContent = `${height}p`;
            qualityMenu.appendChild(option);
        });

        const options = qualityMenu.querySelectorAll('.quality-option');
        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                const level = parseInt(e.target.dataset.level);
                
                // Update active class
                options.forEach(o => o.classList.remove('active'));
                e.target.classList.add('active');
                
                // Set HLS level
                if (hls) {
                    hls.currentLevel = level;
                }
                
                // Update display
                currentQualityDisplay.textContent = e.target.textContent;
            });
        });
    };

    // --- Load Stream Logic ---
    const loadStream = (url) => {
        if (!url) return;
        
        loadingOverlay.classList.add('active');

        if (Hls.isSupported()) {
            if (hls) {
                hls.destroy();
            }
            
            hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                loadingOverlay.classList.remove('active');
                video.play().catch(() => {
                    console.log("Autoplay prevented, waiting for user interaction");
                });
                
                if (data.levels && data.levels.length > 0) {
                    populateQualityMenu(data.levels);
                    qualityBtn.style.display = 'flex';
                } else {
                    qualityBtn.style.display = 'none';
                }
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error("fatal network error encountered, try to recover");
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error("fatal media error encountered, try to recover");
                            hls.recoverMediaError();
                            break;
                        default:
                            hls.destroy();
                            break;
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari native HLS support
            video.src = url;
            video.addEventListener('loadedmetadata', () => {
                loadingOverlay.classList.remove('active');
                video.play();
            });
            qualityBtn.style.display = 'none'; // Native doesn't expose levels easily
        } else {
            alert('Your browser does not support HLS playback.');
            loadingOverlay.classList.remove('active');
        }
    };

    loadBtn.addEventListener('click', () => {
        loadStream(streamUrlInput.value);
    });

    streamUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadStream(streamUrlInput.value);
        }
    });
});
