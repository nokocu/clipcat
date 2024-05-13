// waveforms

// Update waveform based on the video source
function updateWaveform(newSource) {
    const waveformContainer = document.getElementById('waveform');
    const waveformWidth = waveformContainer.clientWidth;
    if (newSource.startsWith('/')) {
        newSource = newSource.substring(1);
    }
    const [basePath, queryParams] = newSource.split('?');
    const encodedBasePath = encodeURIComponent(basePath);
    const url = `/waveform/${encodedBasePath}` + (queryParams ? `?${queryParams}&` : '?') + `width=${waveformWidth}`;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            waveformContainer.style.backgroundImage = `url(data:image/png;base64,${data.image})`;
        })
        .catch(err => console.error('Error loading waveform:', err));
}

// Initial waveform update on metadata load
function initializeWaveform() {

    const video = document.getElementById("videoToClip");
    function onMetadataLoaded() {
        const src = video.currentSrc.substring(window.location.origin.length);
        updateWaveform(src);
        video.removeEventListener('loadedmetadata', onMetadataLoaded);
    }
    video.addEventListener('loadedmetadata', onMetadataLoaded);
};

// Update waveform on window resize
let resizeTimer;
window.addEventListener('resize', function() {
    const video = document.getElementById("videoToClip");
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        const src = video.currentSrc.substring(window.location.origin.length);
        updateWaveform(src);
    }, 250);
});