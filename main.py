# 0.14
from flask import Flask, request, render_template, jsonify, redirect, url_for, send_file, Response
from werkzeug.utils import secure_filename
from contextlib import redirect_stdout
from io import StringIO
import threading
import re
import atexit
from cat_ffmpeg import *
from cat_pywebview import *
from cat_tools import *

########################################################################################################################
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('KEY')
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
webview.settings['ALLOW_DOWNLOADS'] = True

# routes ##############################################################################################################
@app.route('/')
def home():
    return render_template("index.html")

@app.route('/undo', methods=['POST'])
def handle_undo():
    logger.info(f"[handle_undo] session info: {session}")
    data = request.get_json()
    current_video = data.get('currentVideo')
    current_video = current_video.split("/video")[1]
    current_video = os.path.join(temp_dir_path, f"{current_video.split('/')[-1]}")

    if 'undo_stack' not in session or not session['undo_stack']:
        logger.info("[handle_undo] Undo stack is empty")
        return jsonify({'success': False, 'error': 'No more actions to undo'})

    push_current_state_to_redo(current_video)
    last_state = session['undo_stack'].pop()
    session["src_to_wave"] = last_state
    log_stack()
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
    session["src_to_wave"] = last_state
    log_stack()
    video_path = f"/video/{os.path.basename(last_state)}"
    return jsonify({'success': True, 'message': f"Restored {last_state}", 'video_path': video_path})

@app.route('/cleanup', methods=['GET'])
def cleanup_and_home():
    thread = threading.Thread(target=cleanup_temp_dir)
    thread.start()
    session['undo_stack'].clear()
    session['redo_stack'].clear()
    return redirect(url_for('home'))


@app.route('/editor', methods=['GET', 'POST'])
def editor():
    file_name = session.get('file_name', 'Default Video')
    file_name_ext = os.path.splitext(file_name)[1]
    directory = os.path.join(temp_dir_path, f"main{file_name_ext}")
    session['undo_stack'] = []
    session['redo_stack'] = []
    if request.method == 'POST':
        video_file = request.files['video_file']
        filename = secure_filename(video_file.filename)
        file_name_ext = os.path.splitext(filename)[1]
        directory = os.path.join(temp_dir_path, f"main{file_name_ext}")
        video_file.save(directory)
        session["src_to_wave"] = directory
        session['file_name'] = filename
        logger.info(f"[editor] Video saved at: {directory}")

    timestamp = int(time.time())
    video_path = f"/video/main{file_name_ext}?v={timestamp}"
    width, height, fps = metadata(directory)
    logger.info(f"[editor] Booting up template with filename: {file_name}")
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
    log_stack()
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


@app.route('/render_video', methods=['POST'])
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
    current_vid = os.path.join(temp_dir_path, f"{base_filename}{ext}")
    dragged_vid = session.get('dragged_vid')
    dragged_ext = os.path.splitext(dragged_vid)[1]

    if ext != dragged_ext:
        return jsonify({'error': 'File types do not match'}), 400

    output_name_without_digits = ''.join([char for char in base_filename if not char.isdigit()])
    output_from_concat = os.path.join(temp_dir_path, f"{output_name_without_digits}{timestamp}{ext}")
    push_current_state_to_undo(current_vid)
    log_stack()
    concat(current_vid, dragged_vid, output_from_concat)
    response_data = {"output": "/video/" + os.path.basename(output_from_concat)}
    return jsonify(response_data)

@app.route('/waveform/<path:video_path>')
def waveform(video_path):
    width = request.args.get('width', default=918)
    audio_path = extract_audio(session["src_to_wave"])
    waveform_image = generate_waveform(audio_path, width)
    return jsonify({'image': waveform_image})

########################################################################################################################

if __name__ == '__main__':
    stream = StringIO()
    cleanup_temp_dir()
    atexit.register(cleanup_temp_dir)
    with redirect_stdout(stream):
        api_instance = API()
        window = webview.create_window('clipcat', app, width=1018, height=803,
                                       frameless=True, easy_drag=False, js_api=api_instance,
                                       background_color='#33363d', shadow=True, min_size=(585, 533))
        webview.start(bind, window)