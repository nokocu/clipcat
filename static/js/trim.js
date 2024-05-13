// Anchor SVG
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

// Anchor set
function setAnchor(point, anchorId) {
    const video = document.getElementById("videoToClip");
    const currentTime = formatTime(video.currentTime * 1000);
    const anchorA = document.getElementById('anchorA');
    const anchorB = document.getElementById('anchorB');
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

// teleport closest anchor
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
          animationEnd(video);
        } else {
            console.error("Output path is missing in the response");
            endVideoOpacityAnimation(video);
        }
    });
}


