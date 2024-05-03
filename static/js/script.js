// Element selectors
const video = document.getElementById("videoToClip");
const playButton = document.getElementById("playButton");
const backwardButton = document.getElementById("backwardButton");
const forwardButton = document.getElementById("forwardButton");
const currentTimeDisplay = document.getElementById("currentTime");
const totalTimeDisplay = document.getElementById("totalTime");
const anchorA = document.getElementById("anchorA");
const anchorB = document.getElementById("anchorB");
const videoSlider = document.getElementById("videoSlider");

// Global variables
let isHovering = false;
const framerate = parseFloat(document.getElementById('infoFPS').textContent || document.getElementById('infoFPS').value);

// Event listeners
document.addEventListener('keydown', handleKeydown);
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
//    toggleLoading(true);
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
//            toggleLoading(false);
        } else {
            console.error("Output path is missing in the response");
        }
    });
}

// Handle keydown events
document.addEventListener('DOMContentLoaded', function() {
    // Prevent buttons from taking focus on click
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('mousedown', function(event) {
            event.preventDefault();
        });
    });

    // Keydown event handler
    document.addEventListener('keydown', handleKeydown);
});

function handleKeydown(event) {
    // Check if the focused element is an input field
    const activeElement = document.activeElement;
    const isInputFocused = activeElement.tagName === 'INPUT' && activeElement.type === 'text';

    // If an input is focused and Ctrl is not pressed, return unless the key is associated with Ctrl
    if (isInputFocused && !event.ctrlKey) {
        return;
    }

    // Process keydown events based on the key pressed
    switch (event.key) {
        case 'Escape':
            const dialog = document.querySelector('.container-dialog');
            event.preventDefault();
            !dialog.classList.contains('hidden') ? hideDialog() : window.location.href = '/cleanup';
            break;
        case 'z':
            if (event.ctrlKey) {
                event.preventDefault();
                undoVideoEdit();
            }
            break;
        case 'y':
            if (event.ctrlKey) {
                event.preventDefault();
                redoVideoEdit();
            }
            break;
        case 's':
            if (event.ctrlKey) {
                document.getElementById("saveButton").click();
            }
            break;
        case 'w':
            if (event.ctrlKey) {
                event.preventDefault();
                window.location.href = '/cleanup';
            }
            break;
        case '1':
            document.getElementById("mediaA").click();
            break;
        case '2':
            document.getElementById("mediaB").click();
            break;
        case 'c':
        case 'C':
        case 'Delete':
            document.getElementById("mediaProcess").click();
            break;
        case 'a':
        case 'ArrowLeft':
            document.getElementById("backwardButton").click();
            break;
        case 'd':
        case 'ArrowRight':
            document.getElementById("forwardButton").click();
            break;
        case ' ':
        case 'Enter':
            document.getElementById("playButton").click();
            break;
        case 'h':
        case 'H':
            document.getElementById("hintButton").click();
            break;
        default:
            break;
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
    playButton.innerHTML = getSVG('play');
    backwardButton.disabled = false;
    forwardButton.disabled = false;
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

// Volume default value
document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('videoToClip');
    video.volume = 0.1;
});

function renderVideo() {
    const source = video.currentSrc.substring(window.location.origin.length);
    const extension = document.getElementById("extension").value || 'copy';
    const quality = document.getElementById("quality") ? document.getElementById("quality").value : 'ultrafast';
    const targetsize = document.getElementById("targetsize").value || 'copy';
    const resolution = document.getElementById("resolution").value || 'copy';
    const framerate = document.getElementById("framerate").value || 'copy';

    const data = {
        source: source,
        extension: extension,
        quality: quality,
        targetsize: targetsize,
        resolution: resolution,
        framerate: framerate,
    };

    console.log("Sending data to server:", data);

    fetch("render_video", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'rendered_video.mp4';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    })
    .catch(error => console.error('Error downloading the file:', error));
}

// Initialize video time update
updateVideoTime();

// Volume slider
const volumeButton = document.getElementById("volumeButton");
const volumeSliderContainer = document.getElementById("volumeSliderContainer");
volumeButton.addEventListener("mouseenter", () => {
    const rect = volumeButton.getBoundingClientRect();
    volumeSliderContainer.style.display = "block";
    // Adjust position
    volumeSliderContainer.style.left = `${rect.left + 21}px`;
    volumeSliderContainer.style.top = `${rect.top + window.scrollY - 15}px`;
});
volumeButton.addEventListener("mouseleave", () => {
    setTimeout(() => {
        if (!isHovering) volumeSliderContainer.style.display = "none";
    }, 80);
});
volumeSliderContainer.addEventListener("mouseenter", () => isHovering = true);
volumeSliderContainer.addEventListener("mouseleave", () => {
    isHovering = false;
    if (!volumeButton.matches(":hover")) volumeSliderContainer.style.display = "none";
});

document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.setAttribute('tabindex', '-1');
    });
});

// configuration buttons
const overlay = document.getElementById('overlay');
const dialogFilesize = document.getElementById('dialogFilesize');
const dialogResfps = document.getElementById('dialogResfps');
const dialogExtension = document.getElementById('dialogExtension');
const containerControls = document.getElementById('container-config');
document.getElementById('filesizeButton').addEventListener('click', () => showDialogFilesize());
document.getElementById('resfpsButton').addEventListener('click', () => showDialogResfps());
document.getElementById('extensionButton').addEventListener('click', () => showDialogExtension());

// Function to show dialog
function showDialog(dialog) {
    const anchorPos = containerControls
    dialog.style.visibility = 'hidden';
    dialog.classList.remove('hidden');
    const buttonRect = anchorPos.getBoundingClientRect();
    const controlsRect = containerControls.getBoundingClientRect();

    // Set the maximum width of the dialog to match the container-controls
    dialog.style.maxWidth = `${controlsRect.width-10}px`;

    // Calculate and set dialog position
    dialog.style.top = `${buttonRect.top - dialog.offsetHeight-8}px`;
    dialog.style.left = `${buttonRect.left + (buttonRect.width / 2) - (dialog.offsetWidth / 2)}px`;
    dialog.style.visibility = 'visible';
    overlay.classList.remove('hidden');
}

function showDialogFilesize() {
    hideAllDialogs();
    showDialog(dialogFilesize, 'filesizeButton');
}

function showDialogResfps() {
    hideAllDialogs();
    showDialog(dialogResfps, 'resfpsButton');
}

function showDialogExtension() {
    hideAllDialogs();
    showDialog(dialogExtension, 'extensionButton');
}

// Hide all dialogs
function hideAllDialogs() {
    dialogFilesize.classList.add('hidden');
    dialogResfps.classList.add('hidden');
    dialogExtension.classList.add('hidden');
    overlay.classList.add('hidden');
}

// Overlay click to hide dialogs
overlay.addEventListener('click', hideAllDialogs);

// Adjust dialog position on window resize
window.addEventListener('resize', () => {
    if (!dialogFilesize.classList.contains('hidden')) {
        showDialogFilesize();
    }
    if (!dialogResfps.classList.contains('hidden')) {
        showDialogResfps();
    }
    if (!dialogExtension.classList.contains('hidden')) {
        showDialogExtension();
    }
});

// Concat with drag and drop
document.addEventListener('DOMContentLoaded', function() {
    var dropArea = document.getElementById('drop_zone');
    dropArea.addEventListener('dragover', function(e) {
        e.preventDefault();
    });
 dropArea.addEventListener('drop', function(e) {
    e.preventDefault();
    var formData = new FormData();
    formData.append('file', e.dataTransfer.files[0]);
    fetch('/upload_file', {
        method: 'POST',
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log(data.message);
            var videoPath = video.currentSrc.substring(window.location.origin.length);
            const postData = { video: videoPath };
            return fetch('/concat_both', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postData)
            });
        } else {
            throw new Error(data.error);
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Damn. Make sure dragged video has the same extension');
        }
        return response.json();
    })
    .then(response => {
        if (response.output) {
            updateVideoSource(response.output);
        } else {
            console.error("Output path is missing in the response");
        }
    })
    .catch(error => {
        console.error("Error:", error);
        alert(error.message);
        });
    });
})

// loading
//function toggleLoading() {
//    const loadingOverlay = document.getElementById('overlay-loading');
//    if (true) {
//        loadingOverlay.classList.remove('hidden');
//    } else {
//        loadingOverlay.classList.add('hidden');
//    }
//}




