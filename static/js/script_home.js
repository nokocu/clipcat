function chooseFile() {
    document.getElementById('fileInput').click();
}


document.getElementById('fileInput').addEventListener('change', function() {
    var file = this.files[0];
    var formData = new FormData();
    formData.append('video_file', file);


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

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        try {
            pywebview.api.close_window();
        } catch (error) {
            console.error('Error closing window:', error);
        }
    }
});