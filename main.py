# v0.13
from flask import Flask, request, render_template, jsonify, redirect, url_for, session, send_file, Response
from contextlib import redirect_stdout
from io import StringIO
from werkzeug.utils import secure_filename
from webview.dom import DOMEventHandler
from PIL import Image, ImageDraw
from ctypes import windll, Structure, c_long, byref
from pymediainfo import MediaInfo
from math import log
import threading
import logging
import os
import re
import subprocess
import tempfile
import time
import webview
import wave
import base64
import atexit

########################################################################################################################
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default_secret_key')
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

temp_dir_path = os.path.join(tempfile.gettempdir(), "temp_nkc")
os.makedirs(temp_dir_path, exist_ok=True)

print(f"Temporary directory created at {temp_dir_path}")
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
webview.settings['ALLOW_DOWNLOADS'] = True
ffmpeg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ffmpeg.exe')


# FFMPEG tools ########################################################################################################
def concat(source_1, source_2, destination):
    temp_txt_path = os.path.join(temp_dir_path, "temp_concat_list.txt")
    with open(temp_txt_path, 'w') as temp_txt:
        temp_txt.write(f"file '{source_1}'\n")
        temp_txt.write(f"file '{source_2}'\n")
    command = [ffmpeg_path, "-y", "-safe", "0", "-f", "concat", "-i", temp_txt_path, "-c", "copy", destination, "-loglevel", "error"]
    subprocess.run(command)
    removing(temp_txt_path)


def trim(source, a, b, destination, video_length):
    source_ext = os.path.splitext(source)[1]
    temp_a_path = os.path.join(temp_dir_path, f"temp_a{source_ext}")
    temp_b_path = os.path.join(temp_dir_path, f"temp_b{source_ext}")
    if a > b:
        a, b = b, a

    if b == video_length:
        command = [ffmpeg_path, "-ss", "0", "-to", a, "-i", source, "-c", "copy", destination, "-y", "-loglevel", "error"]
        subprocess.run(command)
    elif not a == "00:00.000":
        command = [ffmpeg_path, "-ss", "0", "-to", a, "-i", source, "-c", "copy", temp_a_path, "-y", "-loglevel", "error"]
        subprocess.run(command)
        command = [ffmpeg_path, "-ss", b, "-to", "999999999", "-i", source, "-c", "copy", temp_b_path, "-y", "-loglevel", "error"]
        subprocess.run(command)
        concat(temp_a_path, temp_b_path, destination)
        removing(temp_a_path)
        removing(temp_b_path)
    elif a == "00:00.000":
        command = [ffmpeg_path, "-ss", b, "-to", "999999999", "-i", source, "-c", "copy", destination, "-y", "-loglevel", "error"]
        subprocess.run(command)

    session["src_to_wave"] = destination


def metadata(video_path):
    try:
        media_info = MediaInfo.parse(video_path)
        for track in media_info.tracks:
            if track.track_type == 'Video':
                width = track.width
                height = track.height
                fps = track.frame_rate

                logger.info(f"[metadata]: {width}x{height} @ {fps} FPS")
                return width, height, float(fps)

    except Exception as e:
        logger.error(f"[metadata] Failed to extract video metadata: {str(e)}")
        return "Unknown", "Unknown", "Unknown"


def render(src, ext, qual, size, res, fps):
    start_time = time.time()
    logger.info("[render]: starting")
    os.environ['SVT_LOG'] = 'error'
    src_path, src_ext = os.path.splitext(src)
    out0 = os.path.join(temp_dir_path, f"render.")
    out = f'{out0}' + (src_ext[1:] if ext == "copy" else ext[1:])
    session['rendered_vid'] = out
    cmd = [ffmpeg_path, '-y', '-i', src, '-threads', '0', "-v", "error"]

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
    else:
        cmd.extend(['-c', 'copy'])
        ext = src_ext

    # filesize changer
    if size != "copy":
        try:
            size = max(1, int(size) - 1)
            media_info = MediaInfo.parse(src)
            duration = None
            for track in media_info.tracks:
                if track.track_type == 'General':
                    duration = float(track.duration) / 1000
                    break
            target_bitrate = (size * 8 * 1024) / duration

            if ext == '.webm':
                cmd.extend(['-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', preset_handler(qual, "libvpx-vp9"), '-b:v', f'{target_bitrate:.0f}k', '-bufsize', f'{target_bitrate:.0f}k', '-maxrate', f'{target_bitrate:.0f}k'])
            else:
                cmd.extend(['-b:v', f'{target_bitrate:.0f}k', '-bufsize', f'{target_bitrate:.0f}k', '-maxrate', f'{target_bitrate:.0f}k'])
        except ValueError:
            size = "copy"

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
            media_info = MediaInfo.parse(src)
            current_frame_rate = None
            for track in media_info.tracks:
                if track.track_type == 'Video':
                    current_frame_rate = float(track.frame_rate)
                    break

            if current_frame_rate is None:
                logger.error("Frame rate not found in media info.")

            target_frame_rate = round(float(fps), 3)
            current_frame_rate = round(current_frame_rate, 3)
            if target_frame_rate < current_frame_rate:
                cmd.extend(['-r', str(fps)])
        except ValueError:
            fps = "copy"

    cmd.append(out)
    logger.info(f"[render] {ext=}, {size=}, {res=}, {fps=}")
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
    max_file_size = 2000 * 1024 * 1024  # max file size (2000mb)
    file_name = session.get('file_name', 'Default Video')
    file_name_ext = os.path.splitext(file_name)[1]
    directory = os.path.join(temp_dir_path, f"main{file_name_ext}")
    session['undo_stack'] = []
    session['redo_stack'] = []
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
            directory = os.path.join(temp_dir_path, f"main{file_name_ext}")
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
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        dragged_vid = os.path.join(temp_dir_path, filename)
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
    current_vid = os.path.join(temp_dir_path, f"{base_filename}{ext}")
    dragged_vid = session.get('dragged_vid')

    dragged_ext = os.path.splitext(dragged_vid)[1]
    if ext != dragged_ext:
        return jsonify({'error': 'File types do not match'}), 400

    output_name_without_digits = ''.join([char for char in base_filename if not char.isdigit()])
    output_from_concat = os.path.join(temp_dir_path, f"{output_name_without_digits}{timestamp}{ext}")
    push_current_state_to_undo(current_vid)
    concat(current_vid, dragged_vid, output_from_concat)
    response_data = {"output": "/video/" + os.path.basename(output_from_concat)}
    return jsonify(response_data)

@app.route('/waveform/<path:video_path>')
def waveform(video_path):
    width = request.args.get('width', default=918)
    audio_path = extract_audio(session["src_to_wave"])
    waveform_image = generate_waveform(audio_path, width)
    return jsonify({'image': waveform_image})

# misc ################################################################################################################

def push_current_state_to_undo(video_path):
    if 'undo_stack' not in session:
        session['undo_stack'] = []
    if len(session['undo_stack']) >= 4:
        oldest_path = session['undo_stack'].pop(0)
        if oldest_path not in session['redo_stack']:
            removing(oldest_path)
    session['undo_stack'].append(video_path)

def push_current_state_to_redo(video_path):
    if 'redo_stack' not in session:
        session['redo_stack'] = []
    if len(session['redo_stack']) >= 4:
        oldest_path = session['redo_stack'].pop(0)
        if oldest_path not in session['undo_stack']:
            removing(oldest_path)
    session['redo_stack'].append(video_path)


def cleanup_temp_dir():
    for filename in os.listdir(temp_dir_path):
        file_path = os.path.join(temp_dir_path, filename)
        if os.path.isfile(file_path):
            removing(file_path)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'mp4', 'mkv', 'webm'}



def generate_waveform(audio_path, width):
    width = int(width)

    with wave.open(audio_path, 'r') as wave_file:
        n_frames = wave_file.getnframes()
        frames = wave_file.readframes(n_frames)
        sample_width = wave_file.getsampwidth()
        step = max(1, len(frames) // (width * sample_width))
        amplitude = []

        for i in range(0, len(frames), step * sample_width):
            if sample_width == 2:
                amp = abs(int.from_bytes(frames[i:i+2], byteorder='little', signed=True))
            elif sample_width == 1:
                amp = abs(int.from_bytes(frames[i:i+1], byteorder='little', signed=False) - 128)
            amplitude.append(amp)

        smoothing = 3
        smoothed_amplitude = []
        for i in range(len(amplitude)):
            if i < smoothing:
                smoothed_amplitude.append(amplitude[i])
            else:
                avg_amp = sum(amplitude[i-smoothing:i]) / smoothing
                smoothed_amplitude.append(avg_amp)

        max_amp = max(smoothed_amplitude, default=1)
        try:
            norm_amp = [int(20 * (log(amp + 1) / log(max_amp + 1)) ** 4) for amp in smoothed_amplitude]
        except ZeroDivisionError:
            norm_amp = [1 for amp in smoothed_amplitude]

        if len(norm_amp) > width:
            norm_amp = norm_amp[:width]
        elif len(norm_amp) < width:
            norm_amp += [0] * (width - len(norm_amp))

        img = Image.new('RGBA', (width, 34), (255, 255, 255, 0))
        draw = ImageDraw.Draw(img)
        color = (255, 255, 255, 175)

        for i, amp in enumerate(norm_amp):
            draw.line([(i, 17 - amp), (i, 17 + amp)], fill=color)

        path = os.path.join(temp_dir_path, "waveform.png")
        img.save(path)

        with open(path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode('utf-8')

        return encoded


def extract_audio(video_path):
    audio_path = os.path.join(temp_dir_path, "temp_audio.wav")
    command = [ffmpeg_path, '-i', video_path, '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '1', audio_path, '-y', '-v', "error"]
    subprocess.run(command)
    return audio_path

def log_stack():
    logger.info(f"[log_stack] Undo Stack: {session['undo_stack']}")
    logger.info(f"[log_stack] Redo Stack: {session['redo_stack']}")

def removing(path):
    while True:
        try:
            os.remove(path)
            logger.info(f"[removing] File {path} removed successfully.")
            break
        except FileNotFoundError:
            logger.info(f"[removing] File {path} doesn't exist. Ignoring...")
            break
        except Exception as e:
            logger.error(f"[removing] Failed to remove {path}: {e}.")
            logger.error(f"[removing] Retrying...")
            time.sleep(2)
            break


# pywebview stuff ######################################################################################################

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
    cleanup_temp_dir()
    atexit.register(cleanup_temp_dir)
    with redirect_stdout(stream):
        api_instance = API()
        window = webview.create_window('clipcat', app, width=1018, height=803,
                                       frameless=True, easy_drag=False, js_api=api_instance,
                                       background_color='#33363d', shadow=True, min_size=(585, 533))
        webview.start(bind, window, debug=True)