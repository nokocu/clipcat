// Undo and redo video edits

function undoVideoEdit() {
    const video = document.getElementById("videoToClip");
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
    const video = document.getElementById("videoToClip");
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