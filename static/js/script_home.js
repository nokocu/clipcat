// Funkcja obsługująca zdarzenie wyboru pliku
function chooseFile() {
    document.getElementById('fileInput').click();
}

// Obsługa zdarzenia zmiany pliku
document.getElementById('fileInput').addEventListener('change', function() {
    // Pobierz plik
    var file = this.files[0];
    // Utwórz obiekt FormData
    var formData = new FormData();
    // Dodaj plik do formData
    formData.append('video_file', file);

    // Wyślij plik do serwera za pomocą AJAX
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/editor', true);
    xhr.onload = function () {
        if (xhr.status === 200) {
            // Otrzymano odpowiedź od serwera, przekieruj użytkownika na stronę edytora
            window.location.href = '/editor';
        } else {
            console.error(xhr.statusText);
        }
    };
    xhr.send(formData);
});

document.addEventListener('keydown', event => { if (event.key === 'Escape') pywebview.api.window_close(); });
document.getElementById('minimizeBtn').addEventListener('click', () => pywebview.api.window_minimize());
document.getElementById('maximizeBtn').addEventListener('click', () => pywebview.api.window_maximize());
document.getElementById('exitBtn').addEventListener('click', () => pywebview.api.window_close());