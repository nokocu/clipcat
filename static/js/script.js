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
let interactionsEnabled = true;
const framerate = parseFloat(document.getElementById('infoFPS').textContent || document.getElementById('infoFPS').value);

// Event listeners
document.addEventListener('DOMContentLoaded', initializeEventListeners);

// Initialize all event listeners
function initializeEventListeners() {
    document.addEventListener('keydown', handleKeydown);
    video.addEventListener('timeupdate', updateSlider);
    document.getElementById("mediaA").addEventListener("click", () => setPoint(anchorA, "anchorAValue"));
    document.getElementById("mediaB").addEventListener("click", () => setPoint(anchorB, "anchorBValue"));
    document.getElementById("mediaProcess").addEventListener("click", processVideo);
    document.getElementById('minimizeBtn').addEventListener('click', () => pywebview.api.window_minimize());
    document.getElementById('maximizeBtn').addEventListener('click', () => pywebview.api.window_maximize());
    document.getElementById('exitBtn').addEventListener('click', () => pywebview.api.window_close());
    video.addEventListener('ended', () => playButton.innerHTML = getSVG('play'));
    videoSlider.addEventListener('input', handleSliderInput);
}

// Handle slider input to seek video
function handleSliderInput() {
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
    const currentTime = formatTime(video.currentTime * 1000);
    const totalTime = isNaN(video.duration) ? "00:00.000" : formatTime(video.duration * 1000);
    currentTimeDisplay.textContent = currentTime;
    totalTimeDisplay.textContent = totalTime;
    requestAnimationFrame(updateVideoTime);
}

// Skip video frames
function skip(value) {
    if (framerate !== 0 && isFinite(framerate) && isFinite(value)) {
        video.currentTime += 1 / framerate * value;
    } else {
        console.error("Invalid or zero framerate: ", framerate);
    }
}

// Set anchor points for video clipping
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

// Process video based on set points
function processVideo() {
    const video = document.getElementById('videoToClip');
    const totalTime = document.getElementById("totalTime").textContent;
    const data = {
        anchor1: document.getElementById("anchorAValue").innerText,
        anchor2: document.getElementById("anchorBValue").innerText,
        video: video.currentSrc.substring(window.location.origin.length),
        totalTime: totalTime
    };
    animationStart(video);
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
            endVideoOpacityAnimation(video);
        }
    });
}

// Handle keydown events globally
function handleKeydown(event) {
    const activeElement = document.activeElement;
    const isInputFocused = activeElement.tagName === 'INPUT' && activeElement.type === 'text';
    if (isInputFocused && !event.ctrlKey) {
        return;
    }
    switch (event.key) {
        case 'Escape':
            animationStart(video);
            const dialog = document.querySelector('.container-dialog');
            event.preventDefault();
            !dialog.classList.contains('hidden') ? hideDialog() : window.location.href = '/cleanup';
            break;
        case 'z':
        case 'Z':
            if (event.ctrlKey) {
                event.preventDefault();
                undoVideoEdit(video.currentSrc.substring(window.location.origin.length));
            }
            break;
        case 'y':
        case 'Y':
            if (event.ctrlKey) {
                event.preventDefault();
                redoVideoEdit(video.currentSrc.substring(window.location.origin.length));
            }
            break;
        case 's':
        case 'S':
            if (event.ctrlKey) {
                document.getElementById("saveButton").click();
            }
            break;
        case 'w':
        case 'W':
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
        case 'x':
        case 'X':
            document.getElementById("mediaProcess").click();
            break;
        case 'a':
        case 'A':
        case 'ArrowLeft':
            document.getElementById("backwardButton").click();
            break;
        case 'd':
        case 'D':
        case 'ArrowRight':
            document.getElementById("forwardButton").click();
            break;
        case ' ':
        case 'Enter':
            document.getElementById("playButton").click();
            break;
        default:
            break;
    }
}
// Utility functions

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

// Video processing functions

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
    const totalTime = document.getElementById("totalTime").textContent;
    const processVideoButton = document.getElementById("mediaProcess");
    const disableCondition = (anchor1Text === anchor2Text) ||
                             (anchor1Text === "00:00.000" && anchor2Text === totalTime) ||
                             (anchor1Text === totalTime && anchor2Text === "00:00.000");
    processVideoButton.disabled = disableCondition;
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
        animationEnd(video);
        updateProcessVideoButtonState();
        updateWaveform(newSource);
        setTimeout(() => {
            video.style.minWidth = '';
            video.style.minHeight = '';
        }, 500);
    };
}

// Reset video UI to initial state
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
}

// Undo and redo video edits
function undoVideoEdit(currentVideoSource) {
    fetch('/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentVideo: currentVideoSource })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateVideoSource(data.video_path);
        } else {
            console.log('[script.js undoVideoEdit] Undo failed:', data.error);
        }
    })
    .catch(error => console.error('Error:', error));
}

function redoVideoEdit(currentVideoSource) {
    fetch('/redo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentVideo: currentVideoSource })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateVideoSource(data.video_path);
        } else {
            console.log('[script.js redoVideoEdit] Redo failed:', data.error);
        }
    })
    .catch(error => console.error('Error:', error));
}

// Function to render video with specified settings and download it
function renderVideo() {
    const source = video.currentSrc.substring(window.location.origin.length);
    const extension = document.getElementById("extension").value || 'copy';
    const quality = document.getElementById("quality") ? document.getElementById("quality").value : 'ultrafast';
    const targetsize = document.getElementById("targetsize").value || 'copy';
    const resolution = document.getElementById("resolution").value || 'copy';
    const framerate = document.getElementById("framerate") ? document.getElementById("framerate").value : 'copy';
    const filename = document.getElementById("filename");
    const filenameText = filename ? filename.textContent : "catclipped";

    const data = {
        source: source,
        extension: extension,
        quality: quality,
        targetsize: targetsize,
        resolution: resolution,
        framerate: framerate,
    };

    animationStart(video);

    fetch("render_video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        if (extension !== 'copy') {
            const filenameBase = filenameText.replace(/\.[^.]+$/, "");
            a.download = `clipcat_${filenameBase}${extension}`;
        } else {
            a.download = `clipcat_${filenameText}`;
        }

        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        animationEnd(video);
    })
    .catch(error => {
        console.error('Error downloading the file:', error);
        animationEnd(video);
    });
}


// Initialize video time update
updateVideoTime();

// Volume control
const volumeButton = document.getElementById("volumeButton");
const volumeSliderContainer = document.getElementById("volumeSliderContainer");
volumeButton.addEventListener("mouseenter", () => {
    const rect = volumeButton.getBoundingClientRect();
    volumeSliderContainer.style.display = "block";
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

volumeSlider.addEventListener("input", function() {
    video.volume = volumeSlider.value;
});

// Tab disabled
document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.setAttribute('tabindex', '-1');
    });
});


// Drag and drop functionality
document.addEventListener('DOMContentLoaded', function() {
    var containerTop = document.querySelector('.container-top');
    var dropArea = document.getElementById('drop_zone');
    containerTop.addEventListener('dragover', function(e) {
        this.classList.add('dragging-over');
        e.preventDefault();
    });
    containerTop.addEventListener('mouseleave', function(event) {
        this.classList.remove('dragging-over');
    });
    dropArea.addEventListener('drop', function(e) {
        e.preventDefault();
        animationStart(video);
        var formData = new FormData();
        formData.append('file', e.dataTransfer.files[0]);
        fetch('/upload_to_concut', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
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
                throw new Error('Ensure dragged video has the same extension');
            }
            return response.json();
        })
        .then(response => {
            if (response.output) {
                animationEnd(video);
                updateVideoSource(response.output);
            } else {
                console.error("Output path is missing in the response");
            }
        })
        .catch(error => {
            console.error("Error:", error);
            alert(error.message);
            animationEnd(video);
        });
    });
});

// Handling playback during seeking
let isDragging = false;
let wasPlayingBeforeDrag = false;
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

// Animation functions
function animationStart(video) {
    video.style.transition = 'opacity 0.2s ease-in-out';
    video.style.opacity = '0.5';
    disableInteractions();
    hideAllDialogs();
}

function animationEnd(video) {
    video.style.opacity = '1';
    enableInteractions();
}

function disableInteractions() {
    interactionsEnabled = false;
    const mainButtons = document.querySelectorAll('.btn-main, .btn-secondary');
    mainButtons.forEach(button => {
        button.disabled = true;
    });
    const videoSlider = document.getElementById('videoSlider');
    videoSlider.style.pointerEvents = 'none';
}

function enableInteractions() {
    interactionsEnabled = true;
    const mainButtons = document.querySelectorAll('.btn-main, .btn-secondary');
    mainButtons.forEach(button => {
        button.disabled = false;
    });
    const videoSlider = document.getElementById('videoSlider');
    videoSlider.style.pointerEvents = 'auto';
}
// Waveform update functions

// Update waveform based on the video source
function updateWaveform(newSource) {
    const waveformContainer = document.getElementById('waveform');
    const waveformWidth = waveformContainer.clientWidth;
    if (newSource.startsWith('/')) {
        newSource = newSource.substring(1);
    }
    const [basePath, queryParams] = newSource.split('?');
    const encodedBasePath = encodeURIComponent(basePath);
    const url = `/waveform/${encodedBasePath}` + (queryParams ? `?${queryParams}&` : '?') + `width=${waveformWidth}`;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            waveformContainer.style.backgroundImage = `url(data:image/png;base64,${data.image})`;
        })
        .catch(err => console.error('Error loading waveform:', err));
}

// Initial waveform update on metadata load
document.addEventListener('DOMContentLoaded', function() {
    function onMetadataLoaded() {
        const src = video.currentSrc.substring(window.location.origin.length);
        updateWaveform(src);
        video.removeEventListener('loadedmetadata', onMetadataLoaded);
    }
    video.addEventListener('loadedmetadata', onMetadataLoaded);
});

// Update waveform on window resize
let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        const src = video.currentSrc.substring(window.location.origin.length);
        updateWaveform(src);
    }, 250);
});


// Validate inputs and enable/disable the save button
document.addEventListener("DOMContentLoaded", function() {
    const saveButton = document.getElementById('saveButton');
    const targetSize = document.getElementById('targetsizeC');
    const resolution = document.getElementById('resolutionC');
    targetSize.addEventListener('input', validateInputs);
    resolution.addEventListener('input', validateInputs);

    function validateInputs() {
        const isTargetSizeValid = isValidSize(targetSize.value) || isEmpty(targetSize.value);
        const isResolutionValid = isValidResolution(resolution.value) || isEmpty(resolution.value);
        saveButton.disabled = !(isTargetSizeValid && isResolutionValid);
    }

    function isEmpty(value) {
        return value.trim() === "";
    }

    function isValidSize(value) {
        value = value.replace(/\s+/g, '');
        if (isEmpty(value)) return true;
        const regex = /^\d+(\.\d+)?(mb|gb)?$/i;
        return regex.test(value);
    }

        function isValidResolution(value) {
        value = value.replace(/\s+/g, '');
        if (isEmpty(value)) return true;
        const regex = /^(\d+)x(\d+)$/;
        if (regex.test(value)) {
            const match = value.match(regex);
            const width = parseInt(match[1], 10);
            const height = parseInt(match[2], 10);
            return width >= 1 && height >= 1 && width <= 7680 && height <= 4320;
        }
        return false;
    }
});


// Dialogs related
// Buttons
const overlay = document.getElementById('overlay');
const dialogFilesize = document.getElementById('dialogFilesize');
const dialogResfps = document.getElementById('dialogResfps');
const dialogExtension = document.getElementById('dialogExtension');
const dialogPresets = document.getElementById('dialogPresets');

document.getElementById('filesizeButton').addEventListener('click', function() {
    showDialog(dialogFilesize, 'container-config', this);
});
document.getElementById('resfpsButton').addEventListener('click', function() {
    showDialog(dialogResfps, 'container-config', this);
});
document.getElementById('extensionButton').addEventListener('click', function() {
    showDialog(dialogExtension, 'container-config', this);
});
document.getElementById('presetsButton').addEventListener('click', function() {
    showDialog(dialogPresets, 'container-saving', this);
});


// Function to show dialog
function showDialog(dialog, anchor, button) {
    const dialogVisible = !dialog.classList.contains('hidden');
    hideAllDialogs();

    if (dialogVisible) {
        button.classList.remove('active');
    } else {
        button.classList.add('active');
        const anchorPos = document.getElementById(anchor);
        dialog.style.visibility = 'hidden';
        dialog.classList.remove('hidden');
        const buttonRect = anchorPos.getBoundingClientRect();
        dialog.style.maxWidth = `${buttonRect.width}px`;
        dialog.style.top = `${buttonRect.top - dialog.offsetHeight - 8}px`;
        dialog.style.left = `${buttonRect.left + (buttonRect.width / 2) - (dialog.offsetWidth / 2)}px`;
        dialog.style.visibility = 'visible';
        overlay.classList.remove('hidden');
    }
}


function showDialogFilesize() {
    hideAllDialogs();
    showDialog(dialogFilesize, 'container-config');
}

function showDialogResfps() {
    hideAllDialogs();
    showDialog(dialogResfps, 'container-config');
}

function showDialogExtension() {
    hideAllDialogs();
    showDialog(dialogExtension, 'container-config');
}

function showDialogPresets() {
    hideAllDialogs();
    showDialog(dialogPresets, 'container-saving');
}

overlay.addEventListener('click', hideAllDialogs);
function hideAllDialogs() {
    const dialogs = [dialogFilesize, dialogResfps, dialogExtension, dialogPresets];
    const buttons = [document.getElementById('filesizeButton'), document.getElementById('resfpsButton'), document.getElementById('extensionButton'), document.getElementById('presetsButton')];
    dialogs.forEach(dialog => dialog.classList.add('hidden'));
    buttons.forEach(button => button.classList.remove('active'));
    overlay.classList.add('hidden');
}

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
    if (!dialogPresets.classList.contains('hidden')) {
        showDialogPresets();
    }
});

// Dialog all presets
document.addEventListener('DOMContentLoaded', function() {
    function setupDialog(dialogId, inputId) {
        const dialog = document.getElementById(dialogId);
        const input = document.getElementById(inputId);
        const customInput = dialog.querySelector('input[type="text"]');

        dialog.addEventListener('click', function(event) {
            if (event.target.tagName === 'BUTTON') {
                const buttons = dialog.querySelectorAll('button');
                let isActive = event.target.classList.contains('active');
                buttons.forEach(btn => btn.classList.remove('active'));

                if (isActive) {
                    event.target.classList.remove('active');
                    input.value = '';
                } else {
                    event.target.classList.add('active');
                    input.value = event.target.value;
                    if (customInput) {
                        customInput.value = '';
                    }
                }
            }
        });

        if (customInput) {
            customInput.addEventListener('input', function() {
                const buttons = dialog.querySelectorAll('button');
                buttons.forEach(btn => btn.classList.remove('active'));
                input.value = customInput.value;
            });
        }
    }

    function setupPresets(dialogId) {
        const dialog = document.getElementById(dialogId);

        dialog.addEventListener('click', function(event) {
            if (event.target.tagName === 'BUTTON') {
                const buttons = dialog.querySelectorAll('button');
                let isActive = event.target.classList.contains('active');

                buttons.forEach(btn => btn.classList.remove('active'));

                if (isActive) {
                    event.target.classList.remove('active');
                    resetAllDialogs();
                } else {
                    event.target.classList.add('active');
                    activatePresets(event.target.value);
                }
            }
        });
    }

    function resetAllDialogs() {
        const dialogIds = ['dialogFilesize', 'dialogResfps', 'dialogExtension'];
        dialogIds.forEach(dialogId => {
            const dialog = document.getElementById(dialogId);
            if (dialog) {
                const buttons = dialog.querySelectorAll('button');
                buttons.forEach(btn => btn.classList.remove('active'));
                const input = dialog.querySelector('input[type="text"]');
                if (input) {
                    input.value = '';
                }
            }
        });
    }

    function activatePresets(value) {
        const ids = value.split(' ');
        ids.forEach(id => {
            if (id === 'copy') {
                const resInput = document.getElementById('resolution');
                resInput.value = '';
                const resButtons = document.getElementById('dialogResfps').querySelectorAll('button');
                resButtons.forEach(btn => btn.classList.remove('active'));
            } else {
                const button = document.getElementById(id);
                if (button && !button.classList.contains('active')) {
                    button.click();
                }
            }
        });
    }

    setupDialog('dialogFilesize', 'targetsize');
    setupDialog('dialogResfps', 'resolution');
    setupDialog('dialogExtension', 'extension');
    setupPresets('dialogPresets');
});
