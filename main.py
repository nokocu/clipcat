# v0.10
import threading

from flask import Flask, request, render_template, jsonify, redirect, url_for, session, send_file, Response
from contextlib import redirect_stdout
from io import StringIO
from werkzeug.utils import secure_filename
from webview.dom import DOMEventHandler
import atexit
import logging
import os
import re
import subprocess
import tempfile
import time
import webview
import numpy as np
from pydub import AudioSegment
import base64
from PIL import Image, ImageDraw
from ctypes import windll, Structure, c_long, byref

# flask, logging, tempdir ######################################################################################################
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default_secret_key')
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
temp_dir = tempfile.TemporaryDirectory()
print(f"Temporary directory created at {temp_dir.name}")
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
webview.settings['ALLOW_DOWNLOADS'] = True


# FFMPEG tools ########################################################################################################
def concat(source_1, source_2, destination):
    with tempfile.TemporaryDirectory() as tmp_dir:
        temp_txt_path = tempfile.NamedTemporaryFile(mode='w', dir=tmp_dir, delete=False).name
        with open(temp_txt_path, 'w') as temp_txt:
            temp_txt.write(f"file '{source_1}'\n")
            temp_txt.write(f"file '{source_2}'\n")
        command = ["ffmpeg", "-y", "-safe", "0", "-f", "concat", "-i", temp_txt_path, "-c", "copy", destination, "-loglevel", "error"]
        subprocess.run(command)


def trim(source, a, b, destination, video_length):
    source_ext = os.path.splitext(source)[1]

    with tempfile.TemporaryDirectory() as tmp_dir:
        temp_a_path = tempfile.NamedTemporaryFile(suffix=source_ext, dir=tmp_dir, delete=False).name
        temp_b_path = tempfile.NamedTemporaryFile(suffix=source_ext, dir=tmp_dir, delete=False).name

        # edge case prevention, swap if a is greater than b
        if a > b:
            a, b = b, a

        # logger.info(f"Processing video: ({source}, {a}, {b}, {destination})")

        if b == video_length:
            command = ["ffmpeg", "-ss", "0", "-to", a, "-i", source, "-c", "copy", destination, "-y",
                       "-loglevel", "error"]
            subprocess.run(command)
        elif not a == "00:00.000":
            command = ["ffmpeg", "-ss", "0", "-to", a, "-i", source, "-c", "copy", temp_a_path, "-y", "-loglevel",
                       "error"]
            subprocess.run(command)
            command = ["ffmpeg", "-ss", b, "-to", "999999999", "-i", source, "-c", "copy", temp_b_path, "-y",
                       "-loglevel", "error"]
            subprocess.run(command)
            concat(temp_a_path, temp_b_path, destination)
        elif a == "00:00.000":
            command = ["ffmpeg", "-ss", b, "-to", "999999999", "-i", source, "-c", "copy", destination, "-y",
                       "-loglevel", "error"]
            subprocess.run(command)

        session["src_to_wave"] = destination

def metadata(video_path):
    command = ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "default=noprint_wrappers=1:nokey=1", video_path]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode == 0:
        width, height, fps = result.stdout.split()
        num, den = map(int, fps.split('/'))
        fps = num / den if den != 0 else num
        logger.info(f"[metadata]: {width}x{height} @ {fps} FPS")
        return width, height, fps
    else:
        logger.error("[metadata] Failed to extract video metadata: " + result.stderr)
        return "Unknown", "Unknown", "Unknown"


def render(src, ext, qual, size, res, fps):
    start_time = time.time()
    logger.info("[render]: starting")
    os.environ['SVT_LOG'] = 'error'
    src_path, src_ext = os.path.splitext(src)
    out0 = os.path.join(temp_dir.name, f"render.")
    out = f'{out0}' + (src_ext[1:] if ext == "copy" else ext[1:])
    session['rendered_vid'] = out
    cmd = ['ffmpeg', '-y', '-i', src, '-threads', '0', "-v", "error"]

    # presets (temp hardcoded veryfast in js for now)
    def preset_handler(quality, codec):
        if codec == "libx264":
            return quality
        else:
            presets = {'libsvtav1': {'ultrafast': '12', 'veryfast': '10', 'faster': '8', 'fast': '6', 'medium': '4',
                                     'slow': '2', 'slower': '1', 'veryslow': '0'},
                       'libvpx-vp9': {'ultrafast': '8', 'veryfast': '7', 'faster': '6', 'fast': '5', 'medium': '4',
                                      'slow': '2', 'slower': '1', 'veryslow': '0'}}
            return presets.get(codec, {}).get(quality, None)

    # codecs
    if (src_ext in ['.mp4', '.mkv'] and ext in ['.mp4', '.mkv']) or ext == "copy":
        if (all(x == "copy" for x in [ext, size, res, fps])) or (ext != "copy" and all(x == "copy" for x in [size, res, fps])):
            cmd.extend(['-c', 'copy'])
    elif src_ext in ['.mp4', '.mkv'] and ext == '.webm':
        cmd.extend(['-c:v', 'libsvtav1', '-preset', preset_handler(qual, "libsvtav1"), '-c:a', 'libopus'])
    elif src_ext == '.webm' and ext == '.webm':
        if all(x == "copy" for x in [ext, size, res, fps]):
            cmd.extend(['-c', 'copy'])
        else:
            cmd.extend(['-c:v', 'libx264', '-c:a', 'aac'])
    elif src_ext == '.webm' and ext in ['.mp4', '.mkv']:
        cmd.extend(['-c:v', 'libsvtav1', '-preset', preset_handler(qual, "libx264"), '-c:a', 'libopus'])

    # filesize changer
    if size != "copy":
        try:
            size = max(1, int(size) - 1)
            duration_cmd = ['ffprobe', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', src]
            result = subprocess.run(duration_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            duration = float(result.stdout.strip())
            target_bitrate = (size * 8 * 1024) / duration

            if ext == '.webm':
                cmd.extend(['-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', preset_handler(qual, "libvpx-vp9"), '-b:v', f'{target_bitrate:.0f}k', '-bufsize', f'{target_bitrate:.0f}k', '-maxrate', f'{target_bitrate:.0f}k'])
            else:
                cmd.extend(['-b:v', f'{target_bitrate:.0f}k', '-bufsize', f'{target_bitrate:.0f}k', '-maxrate', f'{target_bitrate:.0f}k'])
        except ValueError:
            pass

    # resolution changer
    if res != "copy":
        try:
            max_res = (7680, 4320)
            min_res = (1, 1)
            width, height = map(int, res.split('x'))
            width = max(min(width, max_res[0]), min_res[0])
            height = max(min(height, max_res[1]), min_res[1])
            cmd.extend(['-s', f"{width}x{height}"])
        except ValueError:
            res = "copy"

    # framerate changer
    if fps != "copy":
        try:
            fps = max(1, int(fps))
            fps = str(fps)
            frame_rate_cmd = ['ffprobe', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'default=noprint_wrappers=1:nokey=1', src]
            result = subprocess.run(frame_rate_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            current_frame_rate = round(eval(result.stdout.strip()), 3)
            target_frame_rate = round(float(fps), 3)
            if target_frame_rate < current_frame_rate:
                cmd.extend(['-r', fps])
        except ValueError:
            pass

    cmd.append(out)
    logger.info(f"[render]: executing: ({' '.join(cmd)})")
    subprocess.run(cmd)
    elapsed_time = time.time() - start_time
    logger.info(f"[render]: finished in {elapsed_time:.2f} seconds.")


# routes ##############################################################################################################
@app.route('/')
def home():
    return render_template("index.html")

@app.route('/undo', methods=['POST'])
def handle_undo():
    if undo_stack:
        last_state = undo_stack.pop()
        redo_stack.append(last_state)
        video_path = f"/video/{os.path.basename(last_state)}"
        log_stack()
        return jsonify({'success': True, 'message': f"Reverted to {last_state}", 'video_path': video_path})
    else:
        logger.info("[handle_undo] Undo stack is empty")
        return jsonify({'success': False, 'error': 'No more actions to undo'})


@app.route('/redo', methods=['POST'])
def handle_redo():
    if redo_stack:
        last_state = redo_stack.pop()
        undo_stack.append(last_state)
        video_path = f"/video/{os.path.basename(last_state)}"
        log_stack()
        return jsonify({'success': True, 'message': f"Restored {last_state}", 'video_path': video_path})
    else:
        logger.info("[handle_redo] Redo stack is empty")
        return jsonify({'success': False, 'error': 'No more actions to redo'})


@app.route('/cleanup', methods=['GET'])
def cleanup_and_home():
    thread = threading.Thread(target=cleanup_temp_dir)
    thread.start()
    undo_stack.clear()
    redo_stack.clear()
    return redirect(url_for('home'))


@app.route('/editor', methods=['GET', 'POST'])
def editor():
    max_file_size = 2000 * 1024 * 1024  # max file size (2000mb)
    file_name = session.get('file_name', 'Default Video')
    file_name_ext = os.path.splitext(file_name)[1]
    directory = os.path.join(temp_dir.name, f"main{file_name_ext}")

    if request.method == 'POST':
        video_file = request.files['video_file']
        if video_file and allowed_file(video_file.filename):
            video_file.seek(0, os.SEEK_END)
            file_size = video_file.tell()
            video_file.seek(0)
            if file_size > max_file_size:
                logger.info("[editor] File is too large")
                return jsonify({'error': 'File is too large'})
            filename = secure_filename(video_file.filename)
            file_name_ext = os.path.splitext(filename)[1]
            directory = os.path.join(temp_dir.name, f"main{file_name_ext}")
            video_file.save(directory)
            session["src_to_wave"] = directory
            session['file_name'] = filename
            logger.info(f"[editor] Video saved at: {directory}")
        else:
            return jsonify({'error': 'Invalid file type'})

    file_name_noext = os.path.splitext(file_name)[0]
    timestamp = int(time.time())
    video_path = f"/video/main{file_name_ext}?v={timestamp}"
    width, height, fps = metadata(directory)
    logger.info(f"[editor] Booting up template with filename: {file_name}")
    return render_template("editor.html", video_path=video_path, width=width, height=height, fps=fps, file_name=file_name, file_name_noext=file_name_noext, file_name_ext=file_name_ext)

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
    source_to_trim = os.path.join(temp_dir.name, f"{base_filename}{ext}")
    output_name_without_digits = ''.join([char for char in base_filename if not char.isdigit()])
    output_from_trim = os.path.join(temp_dir.name, f"{output_name_without_digits}{timestamp}{ext}")

    push_current_state_to_undo(source_to_trim)
    log_stack()
    trim(source_to_trim, anchor1, anchor2, output_from_trim, video_length)

    response_data = {"output": "/video/" + os.path.basename(output_from_trim)}
    return jsonify(response_data)

@app.route('/video/<filename>')
def video(filename):
    video_path = os.path.join(temp_dir.name, filename)
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
    logger.info(f"[render_video] {extension=}, {targetsize =}, {resolution=}, {framerate=}")
    video_filename = data.get("source").split('/')[-1].split('?')[0]
    source = os.path.join(temp_dir.name, f"{video_filename}")

    try:
        render(src=source, ext=extension, qual=quality, size=targetsize, res=resolution, fps=framerate)
        return send_file(session.get('rendered_vid'), as_attachment=True)
    except Exception as e:
        logger.error(f"[render_video] Error during video rendering: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/upload_to_concut', methods=['POST'])
def upload_file():
    file = request.files['file']
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        dragged_vid = os.path.join(temp_dir.name, filename)
        file.save(dragged_vid)
        session['dragged_vid'] = dragged_vid
        return jsonify({'success': True, 'message': f'File uploaded to {dragged_vid}'}), 200
    else:
        return jsonify({'error': 'Invalid file type'}), 400

@app.route('/concat_both', methods=['POST'])
def concat_files():
    data = request.get_json()
    video_filename = data.get("video").split('/')[-1].split('?')[0]
    base_filename = video_filename.rsplit('.', 1)[0]
    ext = os.path.splitext(video_filename)[1]
    timestamp = int(time.time())
    current_vid = os.path.join(temp_dir.name, f"{base_filename}{ext}")
    dragged_vid = session.get('dragged_vid')

    dragged_ext = os.path.splitext(dragged_vid)[1]
    if ext != dragged_ext:
        return jsonify({'error': 'File types do not match'}), 400

    output_name_without_digits = ''.join([char for char in base_filename if not char.isdigit()])
    output_from_concat = os.path.join(temp_dir.name, f"{output_name_without_digits}{timestamp}{ext}")
    push_current_state_to_undo(current_vid)
    concat(current_vid, dragged_vid, output_from_concat)
    response_data = {"output": "/video/" + os.path.basename(output_from_concat)}
    return jsonify(response_data)

@app.route('/waveform/<path:video_path>')
def waveform(video_path):
    width = request.args.get('width', default=918)
    audio_path = extract_audio(session["src_to_wave"])
    waveform_image = generate_waveform(audio_path, width)
    os.remove(audio_path)
    return jsonify({'image': waveform_image})

# misc ################################################################################################################
undo_stack = []
redo_stack = []

def push_current_state_to_undo(video_path):
    global undo_stack
    undo_stack.append(video_path)
    # logger.info(f"State pushed to undo stack: {video_path}")

def push_current_state_to_redo(video_path):
    global redo_stack
    redo_stack.append(video_path)
    # logger.info(f"State pushed to redo stack: {video_path}")

def cleanup_temp_dir():
    for filename in os.listdir(temp_dir.name):
        file_path = os.path.join(temp_dir.name, filename)
        if os.path.isfile(file_path):
            while True:
                try:
                    os.remove(file_path)
                    logger.info(f"[cleanup_temp_dir] File {file_path} removed successfully.")
                    break
                except Exception as e:
                    logger.error(f"[cleanup_temp_dir] Failed to remove {file_path}: {e}." )
                    logger.error(f"[cleanup_temp_dir] Retrying...")
                    time.sleep(2)
                    break


def close_window(*args, **kwargs):
    webview.windows[0].destroy()

def on_drag(e):
    pass

def on_drop(e):
    files = e['dataTransfer']['files']
    if len(files) == 0:
        return
    logger.info(f'[on_drop] Event: {e["type"]}. Dropped files:')
    for file in files:
        logger.info(f"[on_drop] {file.get('pywebviewFullPath')}")


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'mp4', 'mkv', 'webm'}

def generate_waveform(audio_path, width):
    audio = AudioSegment.from_file(audio_path)
    data = np.array(audio.get_array_of_samples())
    data = np.abs(data) / np.max(np.abs(data))  # Normalize data
    h = 34  # Fixed height
    img = Image.new('RGBA', (int(width), h), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    for x in range(int(width)):
        amp = data[int(x * len(data) / int(width))] * h  # Scale amplitude to height
        draw.line((x, h / 2 - amp, x, h / 2 + amp), fill='#2b2d33')  # Draw line centered vertically

    temp_dir = tempfile.TemporaryDirectory()
    path = os.path.join(temp_dir.name, "waveform.png")
    img.save(path)
    with open(path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode('utf-8')
    os.remove(path)
    temp_dir.cleanup()
    return encoded

def extract_audio(video_path):
    audio_path = os.path.join(temp_dir.name, "temp_audio.wav")
    command = ['ffmpeg', '-i', video_path, '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '1', audio_path]
    subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return audio_path

def log_stack():
    logger.info(f"[log_stack] Undo Stack: {undo_stack}")
    logger.info(f"[log_stack] Redo Stack: {redo_stack}")

# window resize stuff ##################################################################################################

class API:
    def window_minimize(self):
        webview.windows[0].minimize()

    def window_maximize(self):
        webview.windows[0].toggle_fullscreen()

    def window_close(self):
        webview.windows[0].destroy()

    def resizedrag(self):
        resizewindow(webview.windows[0])

class POINT(Structure):
    _fields_ = [("x", c_long), ("y", c_long)]

def bind(window):
    window.dom.document.events.dragover += DOMEventHandler(on_drag, True, True)
    window.dom.document.events.drop += DOMEventHandler(on_drop, True, True)

def mousepos():
    pt = POINT()
    windll.user32.GetCursorPos(byref(pt))
    return {"x": pt.x, "y": pt.y}

def resizewindow(window):
    VK_LBUTTON = 0x01
    initial_button_state = windll.user32.GetKeyState(VK_LBUTTON)
    initial_width = window.width
    initial_height = window.height
    initial_mouse_position = mousepos()

    while True:
        current_button_state = windll.user32.GetKeyState(VK_LBUTTON)
        if current_button_state != initial_button_state:
            if current_button_state >= 0:
                break
        else:
            current_mouse_position = mousepos()
            try:
                dx = int(initial_mouse_position['x']) - int(current_mouse_position['x'])
                dy = int(initial_mouse_position['y']) - int(current_mouse_position['y'])
                new_width = initial_width - dx
                new_height = initial_height - dy
                window.resize(new_width, new_height)
                initial_mouse_position = current_mouse_position
                initial_width = new_width
                initial_height = new_height
            except:
                logging.info('[doresize]: failed to calculate position changes')
        time.sleep(0.01)

########################################################################################################################

if __name__ == '__main__':
    stream = StringIO()
    with redirect_stdout(stream):
        api_instance = API()
        window = webview.create_window('katcut', app, width=950, height=769,
                                       frameless=True, easy_drag=False, js_api=api_instance,
                                       background_color='#33363d', shadow=True)
        webview.start(bind, window, debug=True)