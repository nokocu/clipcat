// Choose file function
function chooseFile() {
    var fileInput = document.getElementById('fileInput');
    fileInput.setAttribute('accept', '.mp4,.mkv,.webm'); // Restrict file types
    fileInput.click();

}

// Change file
document.getElementById('fileInput').addEventListener('change', function() {
    var file = this.files[0];
    if (!isValidFileType(file)) {
        animationInvalid();
        return;
    }
    animationUploadingStart();
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
            animationUploadingEnd();
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
    var dropZone = document.getElementById('drop-zone');
    var containerTop = document.getElementById('container-top');
    var fileInput = document.getElementById('fileInput');

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

    dropZone.addEventListener('drop', function(event) {
        event.preventDefault();
        animationUploadingStart();
        this.classList.remove('dragging-over');
        var files = event.dataTransfer.files;
        if (isValidFileType(files[0])) {
            fileInput.files = files;
            uploadFile(files[0]);
        } else {
            animationInvalid()
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
                animationUploadingEnd();
            }
        };
        xhr.send(formData);
    }
});

// animations
function animationUploadingStart() {
    const indexText2 = document.getElementById('text-index-2');
    const btnIndex = document.getElementById('btn-index');
    const containerIndex = document.getElementById('container-index');

    indexText2.textContent = 'processing...';
    containerIndex.style.opacity = '0';
    btnIndex.disabled = true;
}

function animationUploadingEnd(video) {
    const indexText2 = document.getElementById('text-index-2');
    const btnIndex = document.getElementById('btn-index');
    const containerIndex = document.getElementById('container-index');

    indexText2.textContent = 'by nokocu';
    containerIndex.style.opacity = '1';
    btnIndex.disabled = false;
}

// Validation of upload
function isValidFileType(file) {
    const validTypes = ['.mp4', '.mkv', '.webm'];
    const fileType = file.name.substring(file.name.lastIndexOf('.'));
    return validTypes.includes(fileType);
}

function animationInvalid() {
    const indexText2 = document.getElementById('text-index-2');
    const btnIndex = document.getElementById('btn-index');
    const containerIndex = document.getElementById('container-index');
    indexText2.textContent = 'Unsupported file type. Please select a .mp4, .mkv, or .webm file.';
    containerIndex.style.opacity = '1';
    btnIndex.disabled = false;
}
