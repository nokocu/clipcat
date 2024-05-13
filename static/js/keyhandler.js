// keyhandler
document.addEventListener('keydown', handleKeydown);
document.addEventListener('mousedown', handleMousedown);

// Handle keydown events globally
function handleKeydown(event) {
    if (!interactionsEnabled && event.key !== 'Escape') {
        event.preventDefault();
        return;
    }
    const activeElement = document.activeElement;
    const isInputFocused = activeElement.tagName === 'INPUT' && activeElement.type === 'text';
    if (isInputFocused && !event.ctrlKey) return;

    switch (event.key) {
        case 'Escape':
            event.preventDefault();
            closeCurrentVid();
            break;
        case 'z': case 'Z':
            if (event.ctrlKey) {
                event.preventDefault();
                undoVideoEdit();
            }
            break;
        case 'y': case 'Y':
            if (event.ctrlKey) {
                event.preventDefault();
                redoVideoEdit();
            }
            break;
        case 's': case 'S':
            if (event.ctrlKey) document.getElementById("saveButton").click();
            break;
        case 'w': case 'W':
            if (event.ctrlKey) {
                event.preventDefault();
                window.location.href = '/';
            }
            break;
        case '1': document.getElementById("mediaA").click(); break;
        case '2': document.getElementById("mediaB").click(); break;
        case 'x': case 'X': document.getElementById("mediaProcess").click(); break;
        case 'a': case 'A': case 'ArrowLeft': document.getElementById("backwardButton").click(); break;
        case 'd': case 'D': case 'ArrowRight': document.getElementById("forwardButton").click(); break;
        case ' ': case 'Enter': document.getElementById("playButton").click(); break;
        default: break;
    }
}

function handleMousedown(event) {
    if (event.button === 1) { // Middle mouse button
        event.preventDefault();
        document.getElementById("mediaProcess").click();
    }
}