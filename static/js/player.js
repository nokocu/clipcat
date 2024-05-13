// videoplayer
function initializePlayerListeners() {
    const video = document.getElementById("videoToClip");
    const videoSlider = document.getElementById("videoSlider");
    video.addEventListener('timeupdate', updateSlider);
    video.addEventListener('ended', () => playButton.innerHTML = getSVG('play'));
    videoSlider.addEventListener('input', handleSliderInput);
}

// Handle slider input to seek video
function handleSliderInput() {
    const video = document.getElementById("videoToClip");
    const videoSlider = document.getElementById("videoSlider");
    const percent = videoSlider.value / 100;
    const newTime = percent * video.duration;
    if (isFinite(newTime)) {
        video.currentTime = newTime;
    } else {
        console.error("Invalid video time:", newTime);
    }
}

// Toggle play/pause for video
function playPause() {
    const video = document.getElementById("videoToClip");
    const playButton = document.getElementById("playButton");
    const backwardButton = document.getElementById("backwardButton");
    const forwardButton = document.getElementById("forwardButton");
    if (video.paused) {
        video.play();
        playButton.innerHTML = getSVG('pause');
        backwardButton.disabled = true;
        forwardButton.disabled = true;
    } else {
        video.pause();
        playButton.innerHTML = getSVG('play');
        backwardButton.disabled = false;
        forwardButton.disabled = false;
    }
}

// Update video time display continuously
function updateVideoTime() {
    const video = document.getElementById("videoToClip");
    const currentTime = formatTime(video.currentTime * 1000);
    const totalTime = isNaN(video.duration) ? "00:00.000" : formatTime(video.duration * 1000);
    const currentTimeDisplay = document.getElementById("currentTime");
    const totalTimeDisplay = document.getElementById("totalTime");
    currentTimeDisplay.textContent = currentTime;
    totalTimeDisplay.textContent = totalTime;
    requestAnimationFrame(updateVideoTime);
}

// Skip video frames
function skip(value) {
    const framerate = parseFloat(document.getElementById('infoFPS').textContent || document.getElementById('infoFPS').value);
    const video = document.getElementById("videoToClip");
    if (framerate !== 0 && isFinite(framerate) && isFinite(value)) {
        video.currentTime += 1 / framerate * value;
    } else {
        console.error("Invalid or zero framerate: ", framerate);
    }
}

// Update the slider based on video duration
function updateSlider() {
    const video = document.getElementById("videoToClip");
    const videoSlider = document.getElementById("videoSlider");
    if (video.duration) {
        const percent = (video.currentTime / video.duration) * 100;
        videoSlider.value = percent;
        updateSvgPositions();
    }
}

// Update video playback time based on slider input
function updateVideoTimeFromSlider() {
    const video = document.getElementById("videoToClip");
    const videoSlider = document.getElementById("videoSlider");
    const percent = videoSlider.value / 100;
    const newTime = percent * video.duration;
    if (isFinite(newTime)) {
        video.currentTime = newTime;
    } else {
        console.error("Invalid video time:", newTime);
    }
}

// Stopping playback during seeking
let isDragging = false;
let wasPlayingBeforeDrag = false;


function initializeSeekingStopper() {
    const videoSlider = document.getElementById("videoSlider");
    const video = document.getElementById("videoToClip");
    const playButton = document.getElementById("playButton");

    videoSlider.addEventListener('mousedown', function() {
        if (!interactionsEnabled) return;
        isDragging = true;
        wasPlayingBeforeDrag = !video.paused;
        playButton.disabled = true;
        if (wasPlayingBeforeDrag) {
            video.pause();
        }
    });

    videoSlider.addEventListener('mouseup', function() {
        if (!interactionsEnabled) return;
        isDragging = false;
        playButton.disabled = false;
        if (wasPlayingBeforeDrag) {
            video.play();
        }
    });
    document.addEventListener('mouseup', function() {
        if (!interactionsEnabled) return;
        if (playButton.disabled) {
            playButton.disabled = false;
        }
        if (isDragging) {
            isDragging = false;
            if (wasPlayingBeforeDrag) {
                video.play();
            }
        }
    });
}

// Update video source and reset UI
function updateVideoSource(newSource) {
    const video = document.getElementById('videoToClip');
    const originalWidth = video.offsetWidth;
    const originalHeight = video.offsetHeight;
    video.style.minWidth = `${originalWidth}px`;
    video.style.minHeight = `${originalHeight}px`;
    const preloadVideo = document.createElement('video');
    preloadVideo.src = newSource;
    preloadVideo.load();
    preloadVideo.oncanplaythrough = function() {
        video.src = newSource;
        video.load();
        resetVideoUI();
        updateProcessVideoButtonState();
        updateWaveform(newSource);
        setTimeout(() => {
            video.style.minWidth = '';
            video.style.minHeight = '';
        }, 500);
    };
}
