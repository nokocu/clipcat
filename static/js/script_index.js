document.getElementById('btn-index').addEventListener('click', () => chooseFile());

// Titlebar
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') pywebview.api.window_close();
});
document.getElementById('minimizeBtn') && document.getElementById('minimizeBtn').addEventListener('click', () => pywebview.api.window_minimize());
document.getElementById('maximizeBtn') && document.getElementById('maximizeBtn').addEventListener('click', () => pywebview.api.window_maximize());
document.getElementById('exitBtn') && document.getElementById('exitBtn').addEventListener('click', () => pywebview.api.window_close());

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


// animations
function animationUploadingStart() {
    const indexText2 = document.getElementById('text-index-2');
    const btnIndex = document.getElementById('btn-index');
    const containerIndex = document.getElementById('container-index');
    const cat = document.getElementById('cat');

    indexText2.textContent = 'processing...';
    cat.classList.add('pulse-animation');
    containerIndex.style.opacity = '0';
    btnIndex.disabled = true;
}

function animationUploadingEnd(video) {
    const indexText2 = document.getElementById('text-index-2');
    const btnIndex = document.getElementById('btn-index');
    const containerIndex = document.getElementById('container-index');
    const cat = document.getElementById('cat');

    indexText2.textContent = 'by nokocu';
    cat.classList.remove('pulse-animation');
    containerIndex.style.opacity = '1';
    btnIndex.disabled = false;
}


function animationInvalid() {
    const indexText2 = document.getElementById('text-index-2');
    const btnIndex = document.getElementById('btn-index');
    const containerIndex = document.getElementById('container-index');
    indexText2.textContent = 'Unsupported file type. Please select a .mp4, .mkv, or .webm file.';
    containerIndex.style.opacity = '1';
    btnIndex.disabled = false;
}

// Dissalow right click
window.addEventListener("contextmenu", e => e.preventDefault());

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
        } // Corrected: Moved the closing brace here
    });


// Choose file function
function chooseFile() {
    var fileInput = document.getElementById('fileInput');
    fileInput.setAttribute('accept', '.mp4,.mkv,.webm'); // Restrict file types
    fileInput.click();
}

// Change file
document.getElementById('fileInput').addEventListener('change', function() {
    const files = this.files;
    if (!files.length) return;
    let allFilesValid = true;
    for (let file of files) {
        if (!isValidFileType(file)) {
            allFilesValid = false;
            break;
        }
    }
    if (!allFilesValid) {
        animationInvalid();
        return;
    }
    animationUploadingStart();
    var formData = new FormData();
    for (let file of files) {
        formData.append('video_files', file);
    }
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);
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

// drag'n'drop
document.addEventListener('DOMContentLoaded', function() {
    var dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragging-over');
    });
    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.classList.remove('dragging-over');
    });
    dropZone.addEventListener('drop', function(event) {
        event.preventDefault();
        this.classList.remove('dragging-over');
        const files = event.dataTransfer.files;
        if (!files.length) return;

        let allFilesValid = true;
        for (let file of files) {
            if (!isValidFileType(file)) {
                allFilesValid = false;
                break;
            }
        }

        if (!allFilesValid) {
            animationInvalid();
            return;
        }

        animationUploadingStart();
        var formData = new FormData();
        for (let file of files) {
            formData.append('video_files', file);
        }

        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload', true);
        xhr.onload = function() {
            if (xhr.status === 200) {
                window.location.href = '/editor';
            } else {
                console.error("Error during file upload: " + xhr.statusText);
                animationUploadingEnd();
            }
        };
        xhr.send(formData);
    });
});



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