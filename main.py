# v0.20
from flask import Flask, render_template, jsonify, redirect, url_for, send_file, Response
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
cpu_count = multiprocessing.cpu_count()
browser_mode = True

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


@app.route('/editor', methods=['GET', 'POST'])
def editor():
    file_name = session.get('file_name', 'Default Video')
    file_name_ext = os.path.splitext(file_name)[1]
    directory = os.path.join(temp_dir_path, f"main{file_name_ext}")
    if request.method == 'POST':
        video_file = request.files['video_file']
        filename = secure_filename(video_file.filename)
        file_name_ext = os.path.splitext(filename)[1]
        directory = os.path.join(temp_dir_path, f"main{file_name_ext}")
        video_file.save(directory)
        session["current_src"] = directory
        session['file_name'] = filename

    timestamp = int(time.time())
    video_path = f"/video/main{file_name_ext}?v={timestamp}"
    width, height, fps = metadata(directory)
    return render_template("editor.html", video_path=video_path, width=width, height=height,
                           fps=fps, file_name=file_name, browser_mode=browser_mode)

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
        return "Failed to render video", 400


@app.route('/upload_to_concut', methods=['POST'])
def upload_file():
    file = request.files['file']
    filename = secure_filename(file.filename)
    dragged_vid = os.path.join(temp_dir_path, filename)
    file.save(dragged_vid)
    session['dragged_vid'] = dragged_vid
    return jsonify({'success': True, 'message': f'File uploaded to {dragged_vid}'}), 200


@app.route('/concat_both', methods=['POST'])
def concat_files():
    data = request.get_json()
    video_filename = data.get("video").split('/')[-1].split('?')[0]
    base_filename = video_filename.rsplit('.', 1)[0]
    ext = os.path.splitext(video_filename)[1]
    timestamp = int(time.time())
    source_to_concat = os.path.join(temp_dir_path, f"{base_filename}{ext}")
    dragged_vid = session.get('dragged_vid')
    dragged_ext = os.path.splitext(dragged_vid)[1]
    output_name_without_digits = ''.join([char for char in base_filename if not char.isdigit()])
    output_from_concat = os.path.join(temp_dir_path, f"{output_name_without_digits}{timestamp}{ext}")

    if ext != dragged_ext:
        return jsonify({'error': 'File types do not match'}), 400

    push_current_state_to_undo(source_to_concat)
    concat(source_to_concat, dragged_vid, output_from_concat)

    for file in session['redo_stack']:
        removing(file)
    session['redo_stack'].clear()

    response_data = {"output": "/video/" + os.path.basename(output_from_concat)}
    return jsonify(response_data)

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

########################################################################################################################

def run_browser_mode():
    webbrowser.open("http://localhost:1337/")
    serve(app, host='127.0.0.1', port=1337, threads=cpu_count)

def run_webview():
    global browser_mode
    browser_mode = False
    window = webview.create_window(
        'clipcat', app, width=1018, height=803, min_size=(714, 603),
        frameless=True, easy_drag=False, shadow=True, focus=True,
        background_color='#33363d', js_api=api_instance)
    webview.start(debug=False)

if __name__ == '__main__':
    atexit.register(cleanup_temp_dir)
    api_instance = API()
    run_webview() if webview_present() else run_browser_mode()



