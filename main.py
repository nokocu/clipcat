# v0.22
import threading

from flask import Flask, render_template, jsonify, send_file, Response, redirect, url_for
from werkzeug.utils import secure_filename
import re
import atexit
import multiprocessing
import webbrowser
from cat_ffmpeg import *
from cat_tools import *
from cat_pywebview import *
from waitress import serve

########################################################################################################################
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('KEY', 'PLACEHOLDER')
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
webview.settings['ALLOW_DOWNLOADS'] = True
logger = logging.getLogger(__name__)
cpu_count = multiprocessing.cpu_count()
browser_mode = True
last_active_time = time.time()

# routes ##############################################################################################################
@app.route('/')
def home():
    cleanup_temp_dir()
    session['undo_stack'] = []
    session['redo_stack'] = []
    return render_template("index.html", browser_mode=browser_mode)

@app.route('/undo', methods=['POST'])
def handle_undo():
    data = request.get_json()
    current_video = data.get('currentVideo')
    current_video = current_video.split("/video")[1]
    current_video = os.path.join(temp_dir_path, f"{current_video.split('/')[-1]}")

    if 'undo_stack' not in session or not session['undo_stack']:
        logger.info("[handle_undo] Undo stack is empty")
        return jsonify({'success': False, 'error': 'No more actions to undo'})

    push_current_state_to_redo(current_video)
    last_state = session['undo_stack'].pop()
    session["current_src"] = last_state
    video_path = f"/video/{os.path.basename(last_state)}"
    return jsonify({'success': True, 'message': f"Reverted to {last_state}", 'video_path': video_path})

@app.route('/redo', methods=['POST'])
def handle_redo():
    data = request.get_json()
    current_video = data.get('currentVideo')
    current_video = current_video.split("/video")[1]
    current_video = os.path.join(temp_dir_path, f"{current_video.split('/')[-1]}")

    if 'redo_stack' not in session or not session['redo_stack']:
        logger.info("[handle_redo] Redo stack is empty")
        return jsonify({'success': False, 'error': 'No more actions to redo'})

    push_current_state_to_undo(current_video)
    last_state = session['redo_stack'].pop()
    session["current_src"] = last_state
    video_path = f"/video/{os.path.basename(last_state)}"
    return jsonify({'success': True, 'message': f"Restored {last_state}", 'video_path': video_path})


@app.route('/upload', methods=['POST'])
def upload():
    video_files = request.files.getlist('video_files')
    file_paths = []

    if len(video_files) > 1:
        for video_file in video_files:
            filename = secure_filename(video_file.filename)
            file_name_ext = os.path.splitext(filename)[1]
            directory = os.path.join(temp_dir_path, f"{filename}{file_name_ext}")
            video_file.save(directory)
            file_paths.append(directory)

        filename = secure_filename(video_files[0].filename)
        file_name_ext = os.path.splitext(filename)[1]
        destination = os.path.join(temp_dir_path, f"main{file_name_ext}")
        print(file_paths)
        concat(file_paths, destination)
        for file in file_paths:
            removing(file)
        session["current_src"] = destination
        session['file_name'] = filename

    else:
        for video_file in video_files:
            filename = secure_filename(video_file.filename)
            file_name_ext = os.path.splitext(filename)[1]
            directory = os.path.join(temp_dir_path, f"main{file_name_ext}")
            video_file.save(directory)
            file_paths.append(directory)
        session["current_src"] = file_paths[0]
        session['file_name'] = video_files[0].filename

    return redirect(url_for('editor'))

@app.route('/editor', methods=['GET'])
def editor():
    file_name = session.get('file_name', 'Default Video')
    file_name_ext = os.path.splitext(file_name)[1]
    directory = os.path.join(temp_dir_path, f"main{file_name_ext}")
    timestamp = int(time.time())
    video_path = f"/video/main{file_name_ext}?v={timestamp}"
    try:
        width, height, fps = metadata(directory)
    except TypeError:
        logger.info("[/editor] Error grabbing metadata")
        width, height, fps = "", "", ""
    return render_template("editor.html", video_path=video_path, width=width, height=height, fps=fps, file_name=file_name)

@app.route("/process_video", methods=["POST"])
def process_video():
    data = request.get_json()
    anchor1 = data.get("anchor1")
    anchor2 = data.get("anchor2")
    video_length = data.get("totalTime")
    video_filename = data.get("video").split('/')[-1].split('?')[0]
    base_filename = video_filename.rsplit('.', 1)[0]
    ext = os.path.splitext(video_filename)[1]
    timestamp = int(time.time())
    source_to_trim = os.path.join(temp_dir_path, f"{base_filename}{ext}")
    output_name_without_digits = ''.join([char for char in base_filename if not char.isdigit()])
    output_from_trim = os.path.join(temp_dir_path, f"{output_name_without_digits}{timestamp}{ext}")

    push_current_state_to_undo(source_to_trim)
    trim(source_to_trim, anchor1, anchor2, output_from_trim, video_length)

    for file in session['redo_stack']:
        removing(file)
    session['redo_stack'].clear()

    response_data = {"output": "/video/" + os.path.basename(output_from_trim)}
    return jsonify(response_data)

@app.route('/video/<filename>')
def video(filename):
    video_path = os.path.join(temp_dir_path, filename)
    range_header = request.headers.get('Range', None)

    if not range_header:
        response = send_file(video_path)
        response.headers['Cache-Control'] = 'no-cache'
        return response

    # high performance video serving
    size = os.path.getsize(video_path)
    start, end = 0, None
    match = re.search(r'(\d+)-(\d*)', range_header)
    if match:
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else size - 1
    length = end - start + 1

    def generate():
        with open(video_path, 'rb') as f:
            f.seek(start)
            remaining = length
            chunk_size = 8192
            while remaining > 0:
                bytes_to_read = min(remaining, chunk_size)
                data = f.read(bytes_to_read)
                if not data:
                    break
                remaining -= len(data)
                yield data

    rv = Response(generate(), 206, mimetype='video/mp4', direct_passthrough=True)
    rv.headers.add('Content-Range', f'bytes {start}-{end}/{size}')
    rv.headers.add('Accept-Ranges', 'bytes')
    rv.headers['Cache-Control'] = 'no-cache'
    return rv


@app.route('/render_video_browser', methods=['POST'])
def render_video():
    data = request.get_json()
    extension = data.get("extension")
    targetsize = data.get("targetsize")
    resolution = data.get("resolution")
    framerate = data.get("framerate")
    quality = data.get("quality")
    video_filename = data.get("source").split('/')[-1].split('?')[0]
    source = os.path.join(temp_dir_path, f"{video_filename}")
    try:
        render(src=source, ext=extension, qual=quality, size=targetsize, res=resolution, fps=framerate)
        return send_file(session.get('rendered_vid'), as_attachment=True)
    except Exception as e:
        logger.error(f"[render_video] Error during video rendering: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/render_video_py', methods=['POST'])
def render_video_pywebview():
    data = request.json
    api = API()
    result = api.render_video(data)
    if result:
        return "Video rendered to {}".format(result), 200
    else:
        return "No save path selected by the user", 400


@app.route('/upload_to_concat', methods=['POST'])
def upload_files():
    files = request.files.getlist('file[]')
    file_paths = []
    for file in files:
        filename = secure_filename(file.filename)
        temp_path = os.path.join(temp_dir_path, filename)
        file.save(temp_path)
        file_paths.append(temp_path)
    session['uploaded_files'] = file_paths
    return jsonify({'success': True, 'message': f'Files uploaded successfully', 'files': file_paths}), 200


@app.route('/concat', methods=['POST'])
def concat_files():
    uploaded_files = session.get('uploaded_files', [])
    if not uploaded_files:
        return jsonify({'error': 'No files uploaded'}), 400

    extensions = {os.path.splitext(file)[1] for file in uploaded_files}
    logging.debug(f"Extensions found: {extensions}")

    if len(extensions) > 1:
        return jsonify({'error': 'File types do not match'}), 400

    ext = extensions.pop()
    timestamp = int(time.time())
    output_filename = f"concatenated_{timestamp}{ext}"
    output_path = os.path.join(temp_dir_path, output_filename)

    push_current_state_to_undo(session["current_src"])
    sources = [session["current_src"]] + uploaded_files
    concat(sources, output_path)
    session["current_src"] = output_path
    for file_path in uploaded_files:
        removing(file_path)

    session.pop('uploaded_files', None)
    response_data = {"output": "/video/" + os.path.basename(output_path)}
    return jsonify(response_data), 200


@app.route('/waveform/<path:video_path>')
def waveform(video_path):
    width = request.args.get('width', default=918)
    audio_path = extract_audio(session["current_src"])
    waveform_image = generate_waveform(audio_path, width)
    return jsonify({'image': waveform_image})


@app.route('/screenshot_browser', methods=['POST'])
def send_screenshot():
    data = request.get_json()
    timestamp = data['timestamp']
    source = session["current_src"]
    last_directory = session.get('last_directory', temp_dir_path)

    destination = os.path.join(last_directory, "screenshot.png")
    screenshot(source, timestamp, destination)

    return send_file(destination, as_attachment=True)

@app.route('/screenshot_py', methods=['POST'])
def send_screenshot_pywebview():
    timestamp = request.form.get('timestamp')
    api = API()
    result = api.save_screenshot(timestamp)
    if result:
        return "Screenshot saved to {}".format(result), 200
    else:
        return "Failed to save screenshot", 400

@app.route('/browser_mode')
def get_browser_mode():
    return jsonify(browser_mode=browser_mode)

@app.route('/browser_mode_inactivity')
def heartbeat():
    global last_active_time
    last_active_time = time.time()
    return jsonify({"status": "alive"})


########################################################################################################################

def check_for_inactivity():
    global last_active_time
    time.sleep(5)
    while True:
        if time.time() - last_active_time > 3:
            os._exit(0)
        time.sleep(1)

def run_browser_mode():
    threading.Thread(target=check_for_inactivity, daemon=True).start()
    webbrowser.open("http://localhost:1337/")
    serve(app, host='127.0.0.1', port=1337, threads=cpu_count)

def run_webview():
    logger.info("running_webview...")
    global browser_mode
    browser_mode = False
    api_instance = API()
    window = webview.create_window('clipcat', app, width=1264, height=944, min_size=(791, 644),
                                   frameless=True, easy_drag=False, shadow=True, focus=True,
                                   background_color='#33363d', js_api=api_instance)
    webview.start(debug=False, gui="edgechromium")

if __name__ == '__main__':
    atexit.register(cleanup_temp_dir)
    if webview_exists():
        run_webview()
    else:
        if internet_check():
            if webview_install():
                run_webview()
            else:
                run_browser_mode()
        else:
            run_browser_mode()

