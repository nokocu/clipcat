// script for /editor

// Upon first load
document.addEventListener('DOMContentLoaded', function() {
    initializeButtons();
    initializePlayerListeners();
    initializeSeekingStopper();
    initializeDialogs();
    initializeConcatenate();
    initializeValidation();
    initializeNoTabbing();
    initializeWaveform();
    initializeVolume();
    updateVideoTime();
    setTimeout(() => {
        updateSvgPositions();
    }, 500);
});


// time formatter
function formatTime(time) {
    var minutes = Math.floor(time / 60000);
    var seconds = Math.floor((time % 60000) / 1000);
    var milliseconds = Math.floor(time % 1000);
    return (minutes < 10 ? "0" + minutes : minutes) + ":" +
           (seconds < 10 ? "0" + seconds : seconds) + "." +
           (milliseconds < 10 ? "00" + milliseconds : milliseconds < 100 ? "0" + milliseconds : milliseconds);
}

// inactivity shutdown (browser mode only)
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


// back to main page
function closeCurrentVid() {
    const video = document.getElementById("videoToClip");
    animationStart(video, 'close');
    window.location.href = '/';
}




















