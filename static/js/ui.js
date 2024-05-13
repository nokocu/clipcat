// ui & animations
let interactionsEnabled = true;

// Buttons
function initializeButtons() {
    document.getElementById("playButton").addEventListener("click", () => playPause())
    document.getElementById("backwardButton").addEventListener("click", () => skip(-1))
    document.getElementById("forwardButton").addEventListener("click", () => skip(1))

    document.getElementById("mediaA").addEventListener("click", () => setAnchor(anchorA, "anchorAValue"));
    document.getElementById("mediaB").addEventListener("click", () => setAnchor(anchorB, "anchorBValue"));
    document.getElementById("mediaProcess").addEventListener("click", processVideo);

    document.getElementById('filesizeButton').addEventListener('click', function() {showDialog(dialogTargetsize, 'container-config', this);});
    document.getElementById('resfpsButton').addEventListener('click', function() {showDialog(dialogResolution, 'container-config', this);});
    document.getElementById('extensionButton').addEventListener('click', function() {showDialog(dialogExtension, 'container-config', this);});

    document.getElementById("ssButton").addEventListener("click", () => screenshot());
    document.getElementById("effectsButton").addEventListener("click", () => screenshot());
    document.getElementById("addButton").addEventListener("click", () => chooseFile());

    document.getElementById('presetsButton').addEventListener('click', function() {showDialog(dialogPresets, 'container-saving', this);});
    document.getElementById("saveButton").addEventListener("click", () => renderVideo());

    document.getElementById("helpButton").addEventListener("click", () => screenshot());
    document.getElementById("undoButton").addEventListener("click", () => undoVideoEdit());
    document.getElementById("redoButton").addEventListener("click", () => redoVideoEdit());
    document.getElementById("closeButton").addEventListener("click", () => closeCurrentVid());

    document.getElementById('minimizeBtn') && document.getElementById('minimizeBtn').addEventListener('click', () => pywebview.api.window_minimize());
    document.getElementById('maximizeBtn') && document.getElementById('maximizeBtn').addEventListener('click', () => pywebview.api.window_maximize());
    document.getElementById('exitBtn') && document.getElementById('exitBtn').addEventListener('click', () => pywebview.api.window_close());
}

// Animations
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


// Flash svgs
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

// disabling interactions
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


// State of the process video button
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

// Validate inputs and enable/disable the save button
function initializeValidation() {
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
};

// limit default interactions - no context menu, no tabbing
window.addEventListener("contextmenu", e => e.preventDefault());
function initializeNoTabbing() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.setAttribute('tabindex', '-1');
    });
};

// returns play/pause svg's
function getSVG(type) {
    const icons = {
        play: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#2b2d33" class="bi bi-play-fill" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/></svg>',
        pause: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#2b2d33" class="bi bi-pause-fill" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5"></path></svg>'
    };
    return icons[type] || '';
}

// volume slider
let isHovering = false;

function initializeVolume() {
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
        const video = document.getElementById("videoToClip");
        video.volume = volumeSlider.value;
    });
}

// Reset video UI to initial state
function resetVideoUI() {
    const videoSlider = document.getElementById('videoSlider');
    const anchorA = document.getElementById("anchorA")
    const anchorB = document.getElementById("anchorB")
    const anchorAsvg = document.getElementById("overlaySvgA")
    const anchorBsvg = document.getElementById("overlaySvgB")
    const playButton = document.getElementById("playButton");
    const backwardButton = document.getElementById("backwardButton");
    const forwardButton = document.getElementById("forwardButton");

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