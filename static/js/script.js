// Element selectors
const video = document.getElementById("videoToClip");
const playButton = document.getElementById("playButton");
const backwardButton = document.getElementById("backwardButton");
const forwardButton = document.getElementById("forwardButton");
const currentTimeDisplay = document.getElementById("currentTime");
const totalTimeDisplay = document.getElementById("totalTime");
const volumeSlider = document.getElementById("volumeSlider");
const volumeSliderContainer = document.getElementById("volumeSliderContainer");
const volumeButton = document.getElementById("volumeButton");
const anchorA = document.getElementById("anchorA");
const anchorB = document.getElementById("anchorB");
const videoSlider = document.getElementById("videoSlider");

// Global variables
let isHovering = false;
const framerate = parseFloat(document.getElementById('infoFPS').textContent || document.getElementById('infoFPS').value);

// Event listeners
document.addEventListener('keydown', handleKeydown);
volumeButton.addEventListener("mouseenter", () => volumeSliderContainer.style.display = "block");
volumeButton.addEventListener("mouseleave", () => setTimeout(() => { if (!isHovering) volumeSliderContainer.style.display = "none"; }, 80));
volumeSliderContainer.addEventListener("mouseenter", () => isHovering = true);
volumeSliderContainer.addEventListener("mouseleave", () => { isHovering = false; if (!volumeButton.matches(":hover")) volumeSliderContainer.style.display = "none"; });
volumeSlider.addEventListener("input", () => video.volume = volumeSlider.value);
videoSlider.addEventListener('input', updateVideoTimeFromSlider);
video.addEventListener('timeupdate', updateSlider);
document.getElementById("mediaA").addEventListener("click", () => setPoint(anchorA, "anchorAValue"));
document.getElementById("mediaB").addEventListener("click", () => setPoint(anchorB, "anchorBValue"));
document.getElementById("mediaProcess").addEventListener("click", processVideo);
document.getElementById('minimizeBtn').addEventListener('click', () => pywebview.api.window_minimize());
document.getElementById('maximizeBtn').addEventListener('click', () => pywebview.api.window_maximize());
document.getElementById('exitBtn').addEventListener('click', () => pywebview.api.window_close());

// Play/Pause toggle
function playPause() {
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

// Update video time display
function updateVideoTime() {
    const currentTime = formatTime(video.currentTime * 1000);
    const totalTime = isNaN(video.duration) ? "00:00.000" : formatTime(video.duration * 1000);
    currentTimeDisplay.textContent = currentTime;
    totalTimeDisplay.textContent = totalTime;
    requestAnimationFrame(updateVideoTime);
}

// Skip frames
function skip(value) {
    if (framerate !== 0 && isFinite(framerate) && isFinite(value)) {
        video.currentTime += 1 / framerate * value;
    } else {
        console.error("Invalid or zero framerate: ", framerate);
    }
}

// Set point A or B
function setPoint(point, anchorId) {
    const currentTime = formatTime(video.currentTime * 1000);
    document.getElementById(anchorId).textContent = currentTime;
    const videoSliderValue = videoSlider.value;
    videoSlider.dataset[point.id] = videoSliderValue;
    const pointPercent = parseFloat(videoSlider.dataset[point.id]) / 100;
    videoSlider.style.setProperty(`--${point.id}-percent`, pointPercent);
    point.style.display = "inline";
    point.style.left = pointPercent * 100 + "%";
    updateProcessVideoButtonState();
}

// Process video
function processVideo() {
    const totalTime = document.getElementById("totalTime").textContent;
    const data = {
        anchor1: document.getElementById("anchorAValue").innerText,
        anchor2: document.getElementById("anchorBValue").innerText,
        video: video.currentSrc.substring(window.location.origin.length),
        totalTime: totalTime
    };

    fetch("process_video", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(response => {
        if (response.output) {
            updateVideoSource(response.output);
        } else {
            console.error("Output path is missing in the response");
        }
    });
}
// Handle keydown events
function handleKeydown(event) {
    if (event.ctrlKey) {
        switch(event.key) {
            case 'z': event.preventDefault(); undoVideoEdit(); break;
            case 'y': event.preventDefault(); redoVideoEdit(); break;
            case 's': document.getElementById("saveButton").click(); break;
            case 'w': event.preventDefault(); window.location.href = '/cleanup'; break;
        }
    } else {
        switch(event.key) {
            case '1': document.getElementById("mediaA").click(); break;
            case '2': document.getElementById("mediaB").click(); break;
            case 'c': case 'C': case 'Delete': document.getElementById("mediaProcess").click(); break;
            case 'a': case 'ArrowLeft': document.getElementById("backwardButton").click(); break;
            case ' ': case 'Enter': document.getElementById("playButton").click(); break;
            case 'd': case 'ArrowRight': document.getElementById("forwardButton").click(); break;
            case 'h': case 'H': document.getElementById("hintButton").click(); break;
            case 'Escape': event.preventDefault(); window.location.href = '/cleanup'; break;
        }
    }
}

// Format time values
function formatTime(time) {
    var minutes = Math.floor(time / 60000);
    var seconds = Math.floor((time % 60000) / 1000);
    var milliseconds = Math.floor(time % 1000);

    return (minutes < 10 ? "0" + minutes : minutes) + ":" +
           (seconds < 10 ? "0" + seconds : seconds) + "." +
           (milliseconds < 10 ? "00" + milliseconds : milliseconds < 100 ? "0" + milliseconds : milliseconds);
}

// Retrieve SVG markup based on the control type
function getSVG(type) {
    const icons = {
        play: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#2b2d33" class="bi bi-play-fill" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/></svg>',
        pause: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#2b2d33" class="bi bi-pause-fill" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5"></path></svg>'
    };
    return icons[type] || '';
}

// Update the slider based on video duration
function updateSlider() {
    if (video.duration) {
        const percent = (video.currentTime / video.duration) * 100;
        videoSlider.value = percent;
    }
}

// Update the state of the process video button
function updateProcessVideoButtonState() {
    const anchor1Text = document.getElementById("anchorAValue").textContent;
    const anchor2Text = document.getElementById("anchorBValue").textContent;
    const processVideoButton = document.getElementById("mediaProcess");
    processVideoButton.disabled = anchor1Text === anchor2Text;
}

// Update video playback time based on slider input
function updateVideoTimeFromSlider() {
    const percent = videoSlider.value / 100;
    const newTime = percent * video.duration;

    if (isFinite(newTime)) {
        video.currentTime = newTime;
    } else {
        console.error("Invalid video time:", newTime);
    }
}

function updateVideoSource(newSource) {
    const video = document.getElementById('videoToClip');
    const preloadVideo = document.getElementById('preloadVideo');

    // Preload new video source
    preloadVideo.src = newSource;
    preloadVideo.load();
    preloadVideo.oncanplaythrough = function() {

        // Update main video source
        video.src = newSource;
        video.load();
        resetVideoUI();
    };
}

function resetVideoUI() {
    const videoSlider = document.getElementById('videoSlider');
    videoSlider.value = 0;
    videoSlider.style.setProperty('--anchorA-percent', '0');
    videoSlider.style.setProperty('--anchorB-percent', '0');
    document.getElementById("anchorA").style.display = "none";
    document.getElementById("anchorB").style.display = "none";
    document.getElementById("anchorAValue").innerText = "00:00.000";
    document.getElementById("anchorBValue").innerText = "00:00.000";
    updateSlider();
    updateProcessVideoButtonState();
}

// Undo video edit
function undoVideoEdit() {
    fetch('/undo', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Undo successful:', data.message);
                updateVideoSource(data.video_path);
            } else {
                console.log('Undo failed:', data.error);
            }
        })
        .catch(error => console.error('Error:', error));
}

// Redo video edit
function redoVideoEdit() {
    fetch('/redo', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Redo successful:', data.message);
                updateVideoSource(data.video_path);
            } else {
                console.log('Redo failed:', data.error);
            }
        })
        .catch(error => console.error('Error:', error));
}


document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('videoToClip');
    video.volume = 0.1;
});

// Initialize video time update
updateVideoTime();