// Function to render video with specified settings and download it
function renderVideo() {
    fetch('/browser_mode')
        .then(response => response.json())
        .then(data => {
            let browser_mode = data.browser_mode;
            if (browser_mode) {
                renderVideoBrowser();
            } else {
                renderVideoPy();
            }
        })
        .catch(error => console.error('Error fetching browser mode:', error));
}


// if in pywebview mode
function renderVideoPy() {
    const video = document.getElementById("videoToClip");
    const source = video.currentSrc.substring(window.location.origin.length);
    const extension = document.getElementById("extension").value || 'copy';
    const quality = document.getElementById("quality") ? document.getElementById("quality").value : 'ultrafast';
    const targetsize = document.getElementById("targetsize").value || 'copy';
    const resolution = document.getElementById("resolution").value || 'copy';
    const framerate = document.getElementById("framerate") ? document.getElementById("framerate").value : 'copy';
    const filename = document.getElementById("filename");
    const filenameText = filename ? filename.textContent.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() : "catclipped";

    let target_filename;

    if (extension !== 'copy') {
        let baseFilename = filenameText.replace(/\.[^/.]+$/, "");
        target_filename = `clipcat_${baseFilename}${extension}`;
    } else {
        target_filename = `clipcat_${filenameText}`;
    }

    const data = {
        source: source,
        extension: extension,
        quality: quality,
        targetsize: targetsize,
        resolution: resolution,
        framerate: framerate,
        target_filename: target_filename,
    };


    animationStart(video, 'render');
    fetch("/render_video_py", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (response.ok) {
            return response.text();
        } else {
            return response.text().then(text => { throw new Error(text); });
        }
    })
    .then(response => {
        console.log('Video rendered:', response);
        animationEnd(video, 'render');
    })
    .catch(error => {
        console.log('Error rendering the video:', error.message);
        animationEnd(video, 'render');
    });
}

// if in browser mode
function renderVideoBrowser() {
    const video = document.getElementById("videoToClip");
    const source = video.currentSrc.substring(window.location.origin.length);
    const extension = document.getElementById("extension").value || 'copy';
    const quality = document.getElementById("quality") ? document.getElementById("quality").value : 'ultrafast';
    const targetsize = document.getElementById("targetsize").value || 'copy';
    const resolution = document.getElementById("resolution").value || 'copy';
    const framerate = document.getElementById("framerate") ? document.getElementById("framerate").value : 'copy';
    const filename = document.getElementById("filename");
    const filenameText = filename ? filename.textContent.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() : "catclipped";

    const data = {
        source: source,
        extension: extension,
        quality: quality,
        targetsize: targetsize,
        resolution: resolution,
        framerate: framerate,
    };

    animationStart(video, 'render');

    fetch("render_video_browser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        if (extension !== 'copy') {
            let baseFilename = filenameText.replace(/\.[^/.]+$/, "");
            a.download = `clipcat_${baseFilename}${extension}`;
        } else {
            a.download = `clipcat_${filenameText}`;
        }
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        animationEnd(video);
    })
    .catch(error => {
        console.error('Error downloading the file:', error);
        animationEnd(video);
    });
}

