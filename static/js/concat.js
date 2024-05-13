function initializeConcatenate() {
    const dropZone = document.getElementById('drop-zone');
    const containerTop = document.getElementById('container-top');
    const overlay = document.getElementById('overlay');
    const fileInput = document.getElementById('fileInput');
    const video = document.getElementById("videoToClip");

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
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0 && files.every(isValidFileType)) {
            animationStart(video, 'concat');
            handleFileUpload(files, () => animationEnd(video));
        } else {
            alert('Ensure all dragged videos have the correct extension');
        }
    });

    // Handle file selection via input
    fileInput.addEventListener('change', function() {
        const files = Array.from(this.files);
        if (files.length > 0 && files.every(isValidFileType)) {
            animationStart(video, 'concat');
            handleFileUpload(files, () => animationEnd(video));
        } else {
            alert('Ensure all selected videos have the correct extension');
        }
    });

    // Function to handle file uploads
    function handleFileUpload(files, callback) {
        var formData = new FormData();
        files.forEach(file => {
            formData.append('file[]', file);
        });

        fetch('/upload_to_concat', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                var videoPath = video.currentSrc.substring(window.location.origin.length);
                const postData = { video: videoPath };
                return fetch('/concat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(postData)
                });
            } else {
                throw new Error(data.error);
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error during video concatenation');
            }
            return response.json();
        })
        .then(response => {
            if (response.output) {
                updateVideoSource(response.output);
                if (callback) callback();
            } else {
                console.error("Output path is missing in the response");
            }
        })
        .catch(error => {
            console.error("Error:", error);
            alert(error.message);
            if (callback) callback();
        });
    }

    // Choose file function
    function chooseFile() {
        fileInput.setAttribute('accept', '.mp4,.mkv,.webm');
        fileInput.click();
    }

    // Validation of upload function
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
}