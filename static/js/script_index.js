// Choose file function
function chooseFile() {
    var fileInput = document.getElementById('fileInput');
    fileInput.setAttribute('accept', '.mp4,.mkv,.webm'); // Restrict file types
    fileInput.click();

}

// Change file
document.getElementById('fileInput').addEventListener('change', function() {
//    showLoading();
    console.log("slucham")
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

// drag'n'drop
document.addEventListener('DOMContentLoaded', function() {
    var containerTop = document.querySelector('.container-top');
    var fileInput = document.getElementById('fileInput');

    containerTop.addEventListener('dragover', function(event) {
        event.preventDefault();
        this.classList.add('dragging-over');
    });

    containerTop.addEventListener('mouseleave', function(event) {
    this.classList.remove('dragging-over');
    });

    containerTop.addEventListener('drop', function(event) {
//        showLoading();
        console.log("slucham")
        event.preventDefault();
        this.classList.remove('dragging-over');
        var files = event.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            uploadFile(files[0]);
        }
    });

    function uploadFile(file) {
        var formData = new FormData();
        formData.append('video_file', file);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/editor', true);
        xhr.onload = function() {
            if (xhr.status === 200) {
                window.location.href = '/editor';
            } else {
                console.error("Error during file upload: " + xhr.statusText);
            }
        };
        xhr.send(formData);
    }
});

// loading
//function showLoading() {
//    const loadingOverlay = document.getElementById('overlay-loading');
//    loadingOverlay.classList.remove('hidden');
//};


