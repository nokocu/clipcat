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

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        try {
            pywebview.api.close_window(); // Correct the function name here
        } catch (error) {
            console.error('Error closing window:', error);
        }
    }
});