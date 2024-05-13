// init ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Global variables
let isHovering = false;
let interactionsEnabled = true;
const framerate = parseFloat(document.getElementById('infoFPS').textContent || document.getElementById('infoFPS').value);

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

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    setTimeout(() => {
        updateSvgPositions();
    }, 500);

});
window.addEventListener("contextmenu", e => e.preventDefault());

// Initialize all event listeners
function initializeEventListeners() {
    document.addEventListener('keydown', handleKeydown);
    video.addEventListener('timeupdate', updateSlider);
    document.getElementById("mediaA").addEventListener("click", () => setAnchor(anchorA, "anchorAValue"));
    document.getElementById("mediaB").addEventListener("click", () => setAnchor(anchorB, "anchorBValue"));
    document.getElementById("mediaProcess").addEventListener("click", processVideo);
    video.addEventListener('ended', () => playButton.innerHTML = getSVG('play'));
    videoSlider.addEventListener('input', handleSliderInput);
    document.getElementById('minimizeBtn') && document.getElementById('minimizeBtn').addEventListener('click', () => pywebview.api.window_minimize());
    document.getElementById('maximizeBtn') && document.getElementById('maximizeBtn').addEventListener('click', () => pywebview.api.window_maximize());
    document.getElementById('exitBtn') && document.getElementById('exitBtn').addEventListener('click', () => pywebview.api.window_close());
}

// Validate inputs and enable/disable the save button
document.addEventListener("DOMContentLoaded", function() {
    const saveButton = document.getElementById('saveButton');
    const targetSize = document.getElementById('targetsizeCustom');
    const resolution = document.getElementById('resolutionCustom');
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

// Tabbing
document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.setAttribute('tabindex', '-1');
    });
});

// animations //////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function animationStart(video, action) {
    video.style.transition = 'opacity 0.2s ease-in-out';
    video.style.opacity = '0.5';
    disableInteractions();
    hideAllDialogs();
    showSvg(action);
}

function animationEnd(video) {
    setTimeout(() => {
        video.style.opacity = '1';
        enableInteractions();
        hideSvg();
    }, 0);
}

function showSvg(action) {
    const svgId = `animationsvg-${action}`;
    const svgElement = document.getElementById(svgId);
    if (svgElement) {
        svgElement.style.opacity = '0.3';
        if (action === "render") {
            svgElement.classList.add('pulse-animation');
        }
    }
}

function hideSvg() {
    const svgs = document.querySelectorAll('.animationsvg');
    svgs.forEach(svg => {
        svg.style.opacity = '0';
        svg.classList.remove('pulse-animation');
    });
}

function disableInteractions() {
    interactionsEnabled = false;
    const mainButtons = document.querySelectorAll('.btn-main, .btn-secondary, .btn-misc, .btn-dialog');
    mainButtons.forEach(button => {
        button.disabled = true;
    });
    const videoSlider = document.getElementById('videoSlider');
    videoSlider.style.pointerEvents = 'none';
}

function enableInteractions() {
    interactionsEnabled = true;
    const mainButtons = document.querySelectorAll('.btn-main, .btn-secondary, .btn-misc, .btn-dialog');
    mainButtons.forEach(button => {
        if (button.id !== "mediaProcess") {
            button.disabled = false;
        }
    });
    const videoSlider = document.getElementById('videoSlider');
    videoSlider.style.pointerEvents = 'auto';
}


// keyhandler //////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Handle keydown events globally
function handleKeydown(event) {
    if (!interactionsEnabled && event.key !== 'Escape') {
        event.preventDefault();
        return;
    }
    const activeElement = document.activeElement;
    const isInputFocused = activeElement.tagName === 'INPUT' && activeElement.type === 'text';
    if (isInputFocused && !event.ctrlKey) return;

    switch (event.key) {
        case 'Escape':
            event.preventDefault();
            closeCurrentVid();
            break;
        case 'z': case 'Z':
            if (event.ctrlKey) {
                event.preventDefault();
                undoVideoEdit();
            }
            break;
        case 'y': case 'Y':
            if (event.ctrlKey) {
                event.preventDefault();
                redoVideoEdit();
            }
            break;
        case 's': case 'S':
            if (event.ctrlKey) document.getElementById("saveButton").click();
            break;
        case 'w': case 'W':
            if (event.ctrlKey) {
                event.preventDefault();
                window.location.href = '/';
            }
            break;
        case '1': document.getElementById("mediaA").click(); break;
        case '2': document.getElementById("mediaB").click(); break;
        case 'x': case 'X': document.getElementById("mediaProcess").click(); break;
        case 'a': case 'A': case 'ArrowLeft': document.getElementById("backwardButton").click(); break;
        case 'd': case 'D': case 'ArrowRight': document.getElementById("forwardButton").click(); break;
        case ' ': case 'Enter': document.getElementById("playButton").click(); break;
        default: break;
    }
}

function closeCurrentVid() {
    animationStart(video, 'close');
    window.location.href = '/';
}

// volume //////////////////////////////////////////////////////////////////////////////////////////////////////////////
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

// waveforms ///////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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

// video ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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

// Update the slider based on video duration
function updateSlider() {
    if (video.duration) {
        const percent = (video.currentTime / video.duration) * 100;
        videoSlider.value = percent;
        updateSvgPositions();
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
    const anchorA = document.getElementById("anchorA")
    const anchorB = document.getElementById("anchorB")
    const anchorAsvg = document.getElementById("overlaySvgA")
    const anchorBsvg = document.getElementById("overlaySvgB")

    videoSlider.value = 0;
    videoSlider.style.setProperty('--anchorA-percent', '0');
    videoSlider.style.setProperty('--anchorB-percent', '0');
    anchorA.classList.add('hidden')
    anchorB.classList.add('hidden')
    anchorAsvg.classList.add('hidden')
    anchorBsvg.classList.add('hidden')

    anchorA.style.left = "0%";
    anchorB.style.left = "0%";
    anchorB.classList.add('hidden')
    document.getElementById("anchorAValue").innerText = "00:00.000";
    document.getElementById("anchorBValue").innerText = "00:00.000";
    playButton.innerHTML = getSVG('play');
    backwardButton.disabled = false;
    forwardButton.disabled = false;
    updateSlider();
    updateSvgPositions();
}

// Undo and redo video edits
function undoVideoEdit() {
    animationStart(video, 'undo');
    fetch('/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentVideo: video.currentSrc.substring(window.location.origin.length) })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            setTimeout(() => {
                updateVideoSource(data.video_path);
                animationEnd(video);
            }, 100);
        } else {
            setTimeout(() => {
                console.log('[script.js redoVideoEdit] undo failed:', data.error);
                animationEnd(video);
            }, 100);
        }
    })
    .catch(error => {
        console.error('Error during undo:', error);
        animationEnd(video);
    });
}

function redoVideoEdit() {
    animationStart(video, 'redo')
    fetch('/redo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentVideo: video.currentSrc.substring(window.location.origin.length) })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            setTimeout(() => {
                updateVideoSource(data.video_path);
                animationEnd(video);
            }, 100);
        } else {
            setTimeout(() => {
                console.log('[script.js redoVideoEdit] Redo failed:', data.error);
                animationEnd(video);
            }, 100);
        }
    })
    .catch(error => console.error('Error:', error));
}

// Function to render video with specified settings and download it
function renderVideo() {
    fetch('/browser_mode')
        .then(response => response.json())
        .then(data => {
            let browser_mode = data.browser_mode;
            if (browser_mode) {
                renderVideoBrowser();
            } else {
                renderVideoPy();
            }
        })
        .catch(error => console.error('Error fetching browser mode:', error));
}

function renderVideoBrowser() {
    const source = video.currentSrc.substring(window.location.origin.length);
    const extension = document.getElementById("extension").value || 'copy';
    const quality = document.getElementById("quality") ? document.getElementById("quality").value : 'ultrafast';
    const targetsize = document.getElementById("targetsize").value || 'copy';
    const resolution = document.getElementById("resolution").value || 'copy';
    const framerate = document.getElementById("framerate") ? document.getElementById("framerate").value : 'copy';
    const filename = document.getElementById("filename");
    const filenameText = filename ? filename.textContent.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() : "catclipped";

    const data = {
        source: source,
        extension: extension,
        quality: quality,
        targetsize: targetsize,
        resolution: resolution,
        framerate: framerate,
    };

    animationStart(video, 'render');

    fetch("render_video_browser", {
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
            let baseFilename = filenameText.replace(/\.[^/.]+$/, "");
            a.download = `clipcat_${baseFilename}${extension}`;
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

function renderVideoPy() {
    const source = video.currentSrc.substring(window.location.origin.length);
    const extension = document.getElementById("extension").value || 'copy';
    const quality = document.getElementById("quality") ? document.getElementById("quality").value : 'ultrafast';
    const targetsize = document.getElementById("targetsize").value || 'copy';
    const resolution = document.getElementById("resolution").value || 'copy';
    const framerate = document.getElementById("framerate") ? document.getElementById("framerate").value : 'copy';
    const filename = document.getElementById("filename");
    const filenameText = filename ? filename.textContent.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() : "catclipped";

    let target_filename;

    if (extension !== 'copy') {
        let baseFilename = filenameText.replace(/\.[^/.]+$/, "");
        target_filename = `clipcat_${baseFilename}${extension}`;
    } else {
        target_filename = `clipcat_${filenameText}`;
    }

    const data = {
        source: source,
        extension: extension,
        quality: quality,
        targetsize: targetsize,
        resolution: resolution,
        framerate: framerate,
        target_filename: target_filename,
    };


    animationStart(video, 'render');
    fetch("/render_video_py", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (response.ok) {
            return response.text();
        } else {
            return response.text().then(text => { throw new Error(text); });
        }
    })
    .then(response => {
        console.log('Video rendered:', response);
        animationEnd(video, 'render');
    })
    .catch(error => {
        console.log('Error rendering the video:', error.message);
        animationEnd(video, 'render');
    });
}

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
    animationStart(video, 'cut');
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

// Initialize video time update
updateVideoTime();

// dialogs /////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Dialogs Buttons
const overlay = document.getElementById('overlay');
const dialogTargetsize = document.getElementById('dialogTargetsize');
const dialogResolution = document.getElementById('dialogResolution');
const dialogExtension = document.getElementById('dialogExtension');
const dialogPresets = document.getElementById('dialogPresets');

document.getElementById('filesizeButton').addEventListener('click', function() {
    showDialog(dialogTargetsize, 'container-config', this);
});
document.getElementById('resfpsButton').addEventListener('click', function() {
    showDialog(dialogResolution, 'container-config', this);
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


function showDialogTargetsize() {
    hideAllDialogs();
    showDialog(dialogTargetsize, 'container-config');
}

function showDialogResolution() {
    hideAllDialogs();
    showDialog(dialogResolution, 'container-config');
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
    const dialogs = [dialogTargetsize, dialogResolution, dialogExtension, dialogPresets];
    const buttons = [document.getElementById('filesizeButton'), document.getElementById('resfpsButton'), document.getElementById('extensionButton'), document.getElementById('presetsButton')];
    dialogs.forEach(dialog => dialog.classList.add('hidden'));
    buttons.forEach(button => button.classList.remove('active'));
    overlay.classList.add('hidden');
}

// Adjust dialog position on window resize
window.addEventListener('resize', () => {
    if (!dialogTargetsize.classList.contains('hidden')) {
        showDialogTargetsize();
    }
    if (!dialogResolution.classList.contains('hidden')) {
        showDialogResolution();
    }
    if (!dialogExtension.classList.contains('hidden')) {
        showDialogExtension();
    }
    if (!dialogPresets.classList.contains('hidden')) {
        showDialogPresets();
    }
});

// Dialog functionalities
document.addEventListener('DOMContentLoaded', function() {
    const dialogTargetsize = document.getElementById('dialogTargetsize');
    const dialogResolution = document.getElementById('dialogResolution');
    const dialogExtension = document.getElementById('dialogExtension');
    const dialogPresets = document.getElementById('dialogPresets');

    document.body.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-dialog')) {
            handleDialogButton(e.target);
        }
    });

    document.body.addEventListener('input', function(e) {
        if (e.target.classList.contains('input-dialog')) {
            handleDialogInput(e.target);
        }
    });

    function handleDialogButton(button) {
        const dialog = button.closest('div');
        if (dialog !== dialogPresets) {
            if (button.classList.contains('active')) {
                button.classList.remove('active');
                clearDialog(dialog);
            } else {
                clearDialog(dialog);
                button.classList.add('active');
                updateTargetValue(dialog, button.value);
            }
            deactivatePresets();
        } else {
            if (button.classList.contains('active')) {
                button.classList.remove('active');
                clearAllDialogs();
            } else {
                clearAllDialogs();
                button.classList.add('active');
                activatePreset(button);
            }
        }
    }

    function handleDialogInput(input) {
        const dialog = input.closest('div');
        clearDialog(dialog, false);
        updateTargetValue(dialog, input.value);
        deactivatePresets();
    }

    function clearDialog(dialog, clearInput = true) {
        const buttons = dialog.querySelectorAll('.btn-dialog.active');
        buttons.forEach(btn => btn.classList.remove('active'));
        if (clearInput) {
            const input = dialog.querySelector('.input-dialog');
            if (input) input.value = '';
        }
        updateTargetValue(dialog, '');
    }

    function updateTargetValue(dialog, value) {
        const targetId = dialog.id.replace('dialog', '').toLowerCase();
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.value = value;
        }
    }

    function activatePreset(button) {
        deactivatePresets();
        button.classList.add('active');
        const values = button.value.split(' ');
        values.forEach(val => {
            const btn = document.getElementById(val);
            if (btn) {
                btn.classList.add('active');
                const dialog = btn.closest('div');
                updateTargetValue(dialog, btn.value);
            }
        });
       setTimeout(() => {renderVideo();}, 200);
    }

    function deactivatePresets() {
        dialogPresets.querySelectorAll('.btn-dialog.active').forEach(btn => btn.classList.remove('active'));
    }

    function clearAllDialogs() {
        [dialogTargetsize, dialogResolution, dialogExtension].forEach(dialog => {
            if (dialog) {
                clearDialog(dialog);
            }
        });
    }
});


// trimming ////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function setAnchor(point, anchorId) {
    const currentTime = formatTime(video.currentTime * 1000);
    document.getElementById(anchorId).textContent = currentTime;

    const videoSliderValue = videoSlider.value;
    videoSlider.dataset[point.id] = videoSliderValue;

    const pointPercent = parseFloat(videoSlider.dataset[point.id]) / 100;
    videoSlider.style.setProperty(`--${point.id}-percent`, pointPercent);

    anchorA.classList.remove('hidden');
    anchorB.classList.remove('hidden');
    point.style.left = pointPercent * 100 + "%";
    updateProcessVideoButtonState();
    updateSvgPositions();

}

let isRightMouseDown = false;
let selectedAnchor = null;


function moveClosestAnchor(event, videoSlider) {
    const posX = event.clientX;
    const rect = videoSlider.getBoundingClientRect();
    let clickPositionPercent = ((posX - rect.left) / rect.width) * 100;

    const anchorA = document.getElementById('anchorA');
    const anchorB = document.getElementById('anchorB');
    const anchorAPosition = parseFloat(anchorA.style.left || '0');
    const anchorBPosition = parseFloat(anchorB.style.left || '0');

    const distanceA = Math.abs(clickPositionPercent - anchorAPosition);
    const distanceB = Math.abs(clickPositionPercent - anchorBPosition);

    selectedAnchor = distanceA < distanceB ? anchorA : anchorB;
    videoSlider.value = clickPositionPercent;

    if (selectedAnchor === anchorA) {
        setAnchor(anchorA, "anchorAValue");
    } else if (selectedAnchor === anchorB) {
        setAnchor(anchorB, "anchorBValue");
    }
}

videoSlider.addEventListener('mousedown', function(event) {
    if (event.button === 2) {
        isRightMouseDown = true;
        moveClosestAnchor(event, videoSlider);
    }
});

document.addEventListener('mousemove', function(event) {
    if (isRightMouseDown && selectedAnchor) {
        moveClosestAnchor(event, videoSlider);
        handleSliderInput();
    }
});

document.addEventListener('mouseup', function(event) {
    if (event.button === 2) {
        isRightMouseDown = false;
        selectedAnchor = null;
    }
});


// Anchor SVG //////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function updateSvgPositions() {
    const anchorA = document.getElementById('anchorA');
    const anchorB = document.getElementById('anchorB');
    const svgA = document.getElementById('overlaySvgA');
    const svgB = document.getElementById('overlaySvgB');

    if (anchorA && anchorB && svgA && svgB) {
        const rectA = anchorA.getBoundingClientRect();
        const rectB = anchorB.getBoundingClientRect();

        svgA.style.position = 'fixed';
        svgA.style.left = `${rectA.left + window.scrollX + rectA.width / 2 - 6}px`;
        svgA.style.top = `${rectA.top + window.scrollY - 19}px`;

        svgB.style.position = 'fixed';
        svgB.style.left = `${rectB.left + window.scrollX + rectB.width / 2 - 6}px`;
        svgB.style.top = `${rectB.top + window.scrollY - 19}px`;

        svgA.classList.remove('hidden');
        svgB.classList.remove('hidden');


    }
}
window.addEventListener('resize', updateSvgPositions);

// concat //////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
document.addEventListener('DOMContentLoaded', function() {
    var dropZone = document.getElementById('drop-zone');
    var containerTop = document.getElementById('container-top');
    var overlay = document.getElementById('overlay');
    var fileInput = document.getElementById('fileInput');

    // Prevent default drag behaviors
    overlay.addEventListener('dragover', function(e) {
        e.preventDefault();
        hideAllDialogs();
    });

    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
    });

    containerTop.addEventListener('dragover', function(e) {
        this.classList.add('dragging-over');
        e.preventDefault();
    });

    containerTop.addEventListener('dragleave', function(event) {
        this.classList.remove('dragging-over');
    });

    containerTop.addEventListener('mouseleave', function(event) {
        this.classList.remove('dragging-over');
    });

    // Handle file drop
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        handleFileUpload(e.dataTransfer.files[0]);
    });

    // Handle file selection via input
    fileInput.addEventListener('change', function() {
        var file = this.files[0];
        if (!isValidFileType(file)) {
            alert('Ensure dragged video has the same extension')
            return;
        }
        animationStart(video, 'concat');
        handleFileUpload(file);

    });

    // Function to handle file uploads
    function handleFileUpload(file) {
        animationStart(video, 'concat');
        var formData = new FormData();
        formData.append('file', file);

        fetch('/upload_to_concut', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                var videoPath = video.currentSrc.substring(window.location.origin.length);
                const postData = {
                    video: videoPath
                };
                return fetch('/concat_both', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
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
    }

    // Choose file function
    function chooseFile() {
        fileInput.setAttribute('accept', '.mp4,.mkv,.webm');
        fileInput.click();
    }

    // Validation of upload
    function isValidFileType(file) {
        if (!file || !file.name) {
            console.error("Invalid file or file name not provided.");
            return false;
        }
        const validTypes = ['.mp4', '.mkv', '.webm'];
        const fileType = file.name.substring(file.name.lastIndexOf('.'));
        return validTypes.includes(fileType);
    }

    window.chooseFile = chooseFile;
});

// Screenshot ///////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function screenshot() {
    fetch('/browser_mode')
        .then(response => response.json())
        .then(data => {
            let browser_mode = data.browser_mode;
            if (browser_mode) {
                screenshotBrowser();
            } else {
                screenshotPy();
            }
        })
        .catch(error => console.error('Error fetching browser mode:', error));
}

function screenshotPy() {
    animationStart(video, 'screenshot')
    const timestamp = document.getElementById('currentTime').textContent;
    fetch('/screenshot_py', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `timestamp=${encodeURIComponent(timestamp)}`
    })
    .then(response => response.text())
    .then(response => {
        animationEnd(video, 'screenshot')
    })
    .catch(error => {
        console.error('Error saving screenshot:', error);
        animationEnd(video, 'screenshot')
    });
}

function screenshotBrowser() {
    animationStart(video, 'screenshot')
    const timestamp = document.getElementById('currentTime').textContent;
    fetch('/screenshot_browser', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ timestamp: timestamp })
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'screenshot.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        animationEnd(video, 'screenshot')
    });
}

// Browser mode inactivity shutdown
function inactivity_monitor() {
    setInterval(() => {
        fetch("http://localhost:1337/browser_mode_inactivity")
            .then(response => response.json())
            .catch(error => console.error('Error:', error));
    }, 1000);
}

fetch('/browser_mode')
    .then(response => response.json())
    .then(data => {
        let browser_mode = data.browser_mode;
        if (browser_mode) {
            inactivity_monitor();
        }
    });