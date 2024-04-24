var video = document.getElementById("videoToClip");
var playButton = document.getElementById("B2");
var backwardButton = document.getElementById("B1");
var forwardButton = document.getElementById("B3");
var framerate = 60;

// Button playpause
function playPause() {
    if (video.paused) {
        video.play();
        playButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#2b2d33" class="bi bi-pause-fill" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5"></path></svg>';
        backwardButton.disabled = true;
        forwardButton.disabled = true;

    } else {
        video.pause();
        playButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#2b2d33" class="bi bi-play-fill" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/></svg>';
        backwardButton.disabled = false;
        forwardButton.disabled = false;

    }
}


// Timestamp
var currentTimeDisplay = document.getElementById("currentTime");
var totalTimeDisplay = document.getElementById("totalTime");

// Timestamp - Realtime refresh function
function updateVideoTime() {
    var currentTime = formatTime(video.currentTime * 1000); // Konwersja sekund na milisekundy
    var totalTime = isNaN(video.duration) ? "00:00.000" : formatTime(video.duration * 1000); // Konwersja sekund na milisekundy

    currentTimeDisplay.textContent = currentTime;
    totalTimeDisplay.textContent = totalTime;

    requestAnimationFrame(updateVideoTime);
}

// Timestamp - Formatting 
function formatTime(time) {
    var minutes = Math.floor(time / (60 * 1000));
    var seconds = Math.floor((time % (60 * 1000)) / 1000);
    var milliseconds = Math.floor((time % 1000));
    return pad(minutes) + ":" + pad(seconds) + "." + pad3(milliseconds);
}
function pad(value) {
    return value < 10 ? "0" + value : value;
}
function pad3(value) {
    if (value < 10) {
        return "00" + value;
    } else if (value < 100) {
        return "0" + value;
    } else {
        return value;
    }
}

// Timestamp - init
updateVideoTime();

// Frame skip 
function skip(value) {
    video.currentTime += 1 / 60 * value;
}

// Keybinds
document.addEventListener('keydown', function(event) {
    switch(event.key) {
        case '1':
            document.getElementById("A1").click();
            break;
        case '2':
            document.getElementById("A2").click();
            break;
        case 'c':
        case 'C':
        case 'Delete':
            document.getElementById("A3").click();
            break;
        case 'a':
        case 'ArrowLeft':
            document.getElementById("B1").click();
            break;
        case ' ':
        case 'Enter':
            document.getElementById("B2").click();
            break;
        case 'd':
        case 'ArrowRight':
            document.getElementById("B3").click();
            break;
        case 'v':
        case 'V':
            document.getElementById("C1").click();
            break;
        case 'h':
        case 'H':
            document.getElementById("C2").click();
            break;
        case 's':
        case 'S':
            if (event.ctrlKey) {
                document.getElementById("C3").click();
            }
            break;
    }
});

// Volume
var volumeSlider = document.getElementById("volumeSlider");
var volumeSliderContainer = document.getElementById("volumeSliderContainer");
var c1Button = document.getElementById("C1");
var isHovering = false

// Volume
c1Button.addEventListener("mouseenter", function() {
    volumeSliderContainer.style.display = "block";
});
c1Button.addEventListener("mouseleave", function() {
    setTimeout(function() {
        if (!isHovering) {
            volumeSliderContainer.style.display = "none";
        }
    }, 80);
});
volumeSliderContainer.addEventListener("mouseenter", function() {
    isHovering = true;
});
volumeSliderContainer.addEventListener("mouseleave", function() {
    isHovering = false;
    setTimeout(function() {
        if (!c1Button.matches(":hover")) {
            volumeSliderContainer.style.display = "none";
        }
    }, 80);
});
volumeSlider.addEventListener("input", function() {
    video.volume = volumeSlider.value;
});

// VideoSlider
function updateVideoTimeFromSlider() {
    var percent = videoSlider.value / 100;
    var newTime = percent * video.duration;

    if (isFinite(newTime)) {
        video.currentTime = newTime;
    } else {
        console.error("Invalid video time:", newTime);
    }
}
function updateSlider() {
    var percent = (video.currentTime / video.duration) * 100;
    videoSlider.value = percent;
}

videoSlider.addEventListener('input', updateVideoTimeFromSlider);

video.addEventListener('timeupdate', updateSlider);

// Resolution and FPS
video.addEventListener('loadedmetadata', function() {
    var resolution = {
        width: video.videoWidth,
        height: video.videoHeight
    };

    var frames = video.webkitDecodedFrameCount;

    var duration = video.duration;

    var fps = Math.round(frames / duration);

    document.getElementById('infoRez').textContent = resolution.width + 'x' + resolution.height;
    document.getElementById('infoFPS').textContent = frames;
});


// AB
var pointA = document.getElementById("pointA");
var pointB = document.getElementById("pointB");

// A
document.getElementById("A1").addEventListener("click", function() {

    var currentTime = formatTime(video.currentTime * 1000);
    document.getElementById("anchor1").textContent = currentTime;
    var videoSliderValue = videoSlider.value;
    videoSlider.dataset.pointA = videoSliderValue;
    var pointAFloat = parseFloat(videoSlider.dataset.pointA) / 100;
    videoSlider.style.setProperty('--pointA-percent', pointAFloat);
    pointA.style.display = "inline";
    var percentA = parseFloat(getComputedStyle(videoSlider).getPropertyValue("--pointA-percent")) || 0;
    pointA.style.left = percentA * 100 + "%";
    
});

// B
document.getElementById("A2").addEventListener("click", function() {

    // B
    var currentTime = formatTime(video.currentTime * 1000);
    document.getElementById("anchor2").textContent = currentTime;
    var videoSliderValue = videoSlider.value;
    videoSlider.dataset.pointB = videoSliderValue;
    var pointBFloat = parseFloat(videoSlider.dataset.pointB) / 100;
    videoSlider.style.setProperty('--pointB-percent', pointBFloat);
    pointB.style.display = "inline";
    var percentB = parseFloat(getComputedStyle(videoSlider).getPropertyValue("--pointB-percent")) || 0;
    pointB.style.left = percentB * 100 + "%";
});


// cut - button
document.getElementById("A3").addEventListener("click", function() {

    var anchor1Text = document.getElementById("anchor1").innerText;
    var anchor2Text = document.getElementById("anchor2").innerText;

    // get the current video source from the video element
    var videoSource = document.getElementById("videoToClip").currentSrc;

    // convert absolute URL to relative URL
    var baseUrl = window.location.origin;
    var relativeVideoSource = videoSource.substring(baseUrl.length);

    // cut - create a payload object with the data
    var data = {
        anchor1: anchor1Text,
        anchor2: anchor2Text,
        video: relativeVideoSource
    };

    // cut - send an AJAX request to Python backend
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "process_video", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(data));

    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
            var response = JSON.parse(xhr.responseText);
            var video = document.getElementById("videoToClip");
            var videoSlider = document.getElementById("videoSlider");

            // reset the video element
            video.pause();
            video.src = response.output

            // remove styles
            videoSlider.removeAttribute("style");
            document.getElementById("pointA").style.display = "none";
            document.getElementById("pointB").style.display = "none";

            // set anchor to 00:00.000
            document.getElementById("anchor1").innerText = "00:00.000";
            document.getElementById("anchor2").innerText = "00:00.000";
        }
    }
});

// back - function to swap file names
function swapFiles() {
    // back - send request to python backend to swap file names
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "swap_files", true);
    xhr.send();

    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
            var response = JSON.parse(xhr.responseText);
            var video = document.getElementById("videoToClip");
            var videoSlider = document.getElementById("videoSlider");

            // back - Reset the video element
            video.pause();
            video.src = response.output

            // back - Remove styles
            videoSlider.removeAttribute("style");
            document.getElementById("pointA").style.display = "none";
            document.getElementById("pointB").style.display = "none";

            // back - set anchor to 00:00.000
            document.getElementById("anchor1").innerText = "00:00.000";
            document.getElementById("anchor2").innerText = "00:00.000";
            }
        }
}

// keybind
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'z') {
        swapFiles();
    }
});