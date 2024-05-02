// Choose file function
function chooseFile() {
    var fileInput = document.getElementById('fileInput');
    fileInput.setAttribute('accept', '.mp4,.mkv,.webm');
    fileInput.click();
}

// Change file
document.getElementById('fileInput').addEventListener('change', function() {
    var file = this.files[0];
    var formData = new FormData();
    formData.append('video_file', file);

    // AJAX
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/editor', true);
    xhr.onload = function () {
        if (xhr.status === 200) {
            window.location.href = '/editor';
        } else {
            console.error(xhr.statusText);
        }
    };
    xhr.send(formData);
});

// Titlebar
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') pywebview.api.window_close();
});
document.getElementById('minimizeBtn').addEventListener('click', () => pywebview.api.window_minimize());
document.getElementById('maximizeBtn').addEventListener('click', () => pywebview.api.window_maximize());
document.getElementById('exitBtn').addEventListener('click', () => pywebview.api.window_close());

// Cat
document.addEventListener('mousemove', function(event) {
    const cat = document.querySelector('.cat');
    const eyes = document.querySelectorAll('.eye-pupil');
    eyes.forEach(eye => {
        const { left, top, width, height } = eye.getBoundingClientRect();
        const eyeCenterX = left + width / 2;
        const eyeCenterY = top + height / 2;
        const deltaX = event.clientX - eyeCenterX;
        const deltaY = event.clientY - eyeCenterY;
        const angle = Math.atan2(deltaY, deltaX);
        const distance = Math.min(10, Math.hypot(deltaX, deltaY));
        const eyeX = distance * Math.cos(angle);
        const eyeY = distance * Math.sin(angle);
        eye.style.transform = `translate(${eyeX}px, ${eyeY}px)`;
    });
});