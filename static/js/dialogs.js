// dialogs
// Dialogs Buttons
const overlay = document.getElementById('overlay');
const dialogTargetsize = document.getElementById('dialogTargetsize');
const dialogResolution = document.getElementById('dialogResolution');
const dialogExtension = document.getElementById('dialogExtension');
const dialogPresets = document.getElementById('dialogPresets');




// Function to show dialog
function showDialog(dialog, anchor, button) {
    const dialogVisible = !dialog.classList.contains('hidden');
    hideAllDialogs();

    if (dialogVisible) {
        button.classList.remove('active');
    } else {
        button.classList.add('active');
        const anchorPos = document.getElementById(anchor);
        dialog.style.visibility = 'hidden';
        dialog.classList.remove('hidden');
        const buttonRect = anchorPos.getBoundingClientRect();
        dialog.style.maxWidth = `${buttonRect.width}px`;
        dialog.style.top = `${buttonRect.top - dialog.offsetHeight - 8}px`;
        dialog.style.left = `${buttonRect.left + (buttonRect.width / 2) - (dialog.offsetWidth / 2)}px`;
        dialog.style.visibility = 'visible';
        overlay.classList.remove('hidden');
    }
}


function showDialogTargetsize() {
    hideAllDialogs();
    showDialog(dialogTargetsize, 'container-config');
}

function showDialogResolution() {
    hideAllDialogs();
    showDialog(dialogResolution, 'container-config');
}

function showDialogExtension() {
    hideAllDialogs();
    showDialog(dialogExtension, 'container-config');
}

function showDialogPresets() {
    hideAllDialogs();
    showDialog(dialogPresets, 'container-saving');
}

overlay.addEventListener('click', hideAllDialogs);
function hideAllDialogs() {
    const dialogs = [dialogTargetsize, dialogResolution, dialogExtension, dialogPresets];
    const buttons = [document.getElementById('filesizeButton'), document.getElementById('resfpsButton'), document.getElementById('extensionButton'), document.getElementById('presetsButton')];
    dialogs.forEach(dialog => dialog.classList.add('hidden'));
    buttons.forEach(button => button.classList.remove('active'));
    overlay.classList.add('hidden');
}

// Adjust dialog position on window resize
window.addEventListener('resize', () => {
    if (!dialogTargetsize.classList.contains('hidden')) {
        showDialogTargetsize();
    }
    if (!dialogResolution.classList.contains('hidden')) {
        showDialogResolution();
    }
    if (!dialogExtension.classList.contains('hidden')) {
        showDialogExtension();
    }
    if (!dialogPresets.classList.contains('hidden')) {
        showDialogPresets();
    }
});

// Dialog functionalities
function initializeDialogs() {
    const dialogTargetsize = document.getElementById('dialogTargetsize');
    const dialogResolution = document.getElementById('dialogResolution');
    const dialogExtension = document.getElementById('dialogExtension');
    const dialogPresets = document.getElementById('dialogPresets');

    document.body.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-dialog')) {
            handleDialogButton(e.target);
        }
    });

    document.body.addEventListener('input', function(e) {
        if (e.target.classList.contains('input-dialog')) {
            handleDialogInput(e.target);
        }
    });

    function handleDialogButton(button) {
        const dialog = button.closest('div');
        if (dialog !== dialogPresets) {
            if (button.classList.contains('active')) {
                button.classList.remove('active');
                clearDialog(dialog);
            } else {
                clearDialog(dialog);
                button.classList.add('active');
                updateTargetValue(dialog, button.value);
            }
            deactivatePresets();
        } else {
            if (button.classList.contains('active')) {
                button.classList.remove('active');
                clearAllDialogs();
            } else {
                clearAllDialogs();
                button.classList.add('active');
                activatePreset(button);
            }
        }
    }

    function handleDialogInput(input) {
        const dialog = input.closest('div');
        clearDialog(dialog, false);
        updateTargetValue(dialog, input.value);
        deactivatePresets();
    }

    function clearDialog(dialog, clearInput = true) {
        const buttons = dialog.querySelectorAll('.btn-dialog.active');
        buttons.forEach(btn => btn.classList.remove('active'));
        if (clearInput) {
            const input = dialog.querySelector('.input-dialog');
            if (input) input.value = '';
        }
        updateTargetValue(dialog, '');
    }

    function updateTargetValue(dialog, value) {
        const targetId = dialog.id.replace('dialog', '').toLowerCase();
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.value = value;
        }
    }

    function activatePreset(button) {
        deactivatePresets();
        button.classList.add('active');
        const values = button.value.split(' ');
        values.forEach(val => {
            const btn = document.getElementById(val);
            if (btn) {
                btn.classList.add('active');
                const dialog = btn.closest('div');
                updateTargetValue(dialog, btn.value);
            }
        });
       setTimeout(() => {renderVideo();}, 200);
    }

    function deactivatePresets() {
        dialogPresets.querySelectorAll('.btn-dialog.active').forEach(btn => btn.classList.remove('active'));
    }

    function clearAllDialogs() {
        [dialogTargetsize, dialogResolution, dialogExtension].forEach(dialog => {
            if (dialog) {
                clearDialog(dialog);
            }
        });
    }
}
