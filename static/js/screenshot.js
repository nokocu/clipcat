// Screenshot button
function screenshot() {
    fetch('/browser_mode')
        .then(response => response.json())
        .then(data => {
            let browser_mode = data.browser_mode;
            if (browser_mode) {
                screenshotBrowser();
            } else {
                screenshotPy();
            }
        })
        .catch(error => console.error('Error fetching browser mode:', error));
}

function screenshotPy() {
    const video = document.getElementById("videoToClip");
    animationStart(video, 'screenshot')
    const timestamp = document.getElementById('currentTime').textContent;
    fetch('/screenshot_py', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `timestamp=${encodeURIComponent(timestamp)}`
    })
    .then(response => response.text())
    .then(response => {
        animationEnd(video, 'screenshot')
    })
    .catch(error => {
        console.error('Error saving screenshot:', error);
        animationEnd(video, 'screenshot')
    });
}

function screenshotBrowser() {
    const video = document.getElementById("videoToClip");
    animationStart(video, 'screenshot')
    const timestamp = document.getElementById('currentTime').textContent;
    fetch('/screenshot_browser', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ timestamp: timestamp })
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'screenshot.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        animationEnd(video, 'screenshot')
    });
}