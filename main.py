import time
from flask import Flask, request, render_template, jsonify, send_from_directory, redirect, url_for
from io import StringIO
from contextlib import redirect_stdout
import webview
import os
import logging
import subprocess
import atexit
import tempfile

# Flask, logging ######################################################################################################
app = Flask(__name__)
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Temporary directory & misc ##########################################################################################
temp_dir = tempfile.TemporaryDirectory()
print(f"Temporary directory created at {temp_dir.name}")
def cleanup_temp_dir():
    for filename in os.listdir(temp_dir.name):
        file_path = os.path.join(temp_dir.name, filename)
        if os.path.isfile(file_path):
            os.remove(file_path)
    logger.info("Temporary directory contents cleared")
atexit.register(cleanup_temp_dir)

def close_window(*args, **kwargs):
    # Close the pywebview window
    webview.windows[0].destroy()

# Undo redo ###########################################################################################################
undo_stack = []
redo_stack = []

def push_current_state_to_undo(video_path):
    global undo_stack
    undo_stack.append(video_path)
    logger.info(f"State pushed to undo stack: {video_path}")

def push_current_state_to_redo(video_path):
    global redo_stack
    redo_stack.append(video_path)
    logger.info(f"State pushed to redo stack: {video_path}")


# FFMPEG tools ########################################################################################################
def concat(source_1, source_2, destination):
    with tempfile.TemporaryDirectory() as tmp_dir:
        temp_txt_path = tempfile.NamedTemporaryFile(mode='w', dir=tmp_dir, delete=False).name
        with open(temp_txt_path, 'w') as temp_txt:
            temp_txt.write(f"file '{source_1}'\n")
            temp_txt.write(f"file '{source_2}'\n")
        command = ["ffmpeg", "-y", "-safe", "0", "-f", "concat", "-i", temp_txt_path, "-c", "copy", destination, "-loglevel", "error"]
        subprocess.run(command)

def trim(source, a, b, destination):
    # hotfix
    if a == "00:00.000":
        a = "00:00.001"
    if b == "00:00.000":
        b = "00:00.001"

    logger.info(f"Processing video: ({source}, {a}, {b}, {destination})")
    with tempfile.TemporaryDirectory() as tmp_dir:
        temp_a_path = tempfile.NamedTemporaryFile(suffix='.mp4', dir=tmp_dir, delete=False).name
        temp_b_path = tempfile.NamedTemporaryFile(suffix='.mp4', dir=tmp_dir, delete=False).name
        command = ["ffmpeg", "-ss", "0", "-to", a, "-i", source, "-c", "copy", temp_a_path, "-y", "-loglevel", "error"]
        subprocess.run(command)
        command = ["ffmpeg", "-ss", b, "-to", "999999999", "-i", source, "-c", "copy", temp_b_path, "-y", "-loglevel", "error"]
        subprocess.run(command)
        concat(temp_a_path, temp_b_path, destination)

def metadata(video_path):
    command = ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "default=noprint_wrappers=1:nokey=1", video_path]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode == 0:
        width, height, fps = result.stdout.split()
        # Convert fps from fraction to integer
        num, den = map(int, fps.split('/'))
        fps = num / den if den != 0 else num
        logger.info(f"tools - metadata: {width}x{height} @ {fps} FPS")
        return width, height, fps
    else:
        logger.error("Failed to extract video metadata: " + result.stderr)
        return "Unknown", "Unknown", "Unknown"

# Routes ##############################################################################################################
@app.route('/')
def home():
    return render_template("index.html")

@app.route('/undo', methods=['POST'])
def handle_undo():
    global undo_stack
    if undo_stack:
        last_state = undo_stack.pop()
        push_current_state_to_redo(last_state)
        logger.info(f"Undo: reverted to {last_state}")
        video_path = f"/video/{os.path.basename(last_state)}"
        return jsonify({'success': True, 'message': f"Reverted to {last_state}", 'video_path': video_path})
    else:
        logger.info("Undo stack is empty")
        return jsonify({'success': False, 'error': 'No more actions to undo'})

@app.route('/redo', methods=['POST'])
def handle_redo():
    global redo_stack, undo_stack
    if redo_stack:
        last_state = redo_stack.pop()
        push_current_state_to_undo(last_state)
        logger.info(f"Redo: restored {last_state}")
        video_path = f"/video/{os.path.basename(last_state)}"
        return jsonify({'success': True, 'message': f"Restored {last_state}", 'video_path': video_path})
    else:
        logger.info("Redo stack is empty")
        return jsonify({'success': False, 'error': 'No more actions to redo'})

@app.route('/cleanup')
def cleanup_and_home():
    cleanup_temp_dir()
    return redirect(url_for('home'))

@app.route('/editor', methods=['GET', 'POST'])
def editor():
    directory = os.path.join(temp_dir.name, "main.mp4")
    if request.method == 'POST':
        if 'video_file' in request.files:
            vid = request.files['video_file']
            vid.save(directory)
            timestamp = int(time.time())
            video_path = f"/video/main.mp4?v={timestamp}"
            width, height, fps = metadata(directory)
            logger.info("Video saved at: %s", directory)
            return render_template("editor.html", video_path=video_path, width=width, height=height, fps=fps)
        else:
            logger.info("No file received")
            return jsonify({'error': 'No file received'})
    timestamp = int(time.time())
    video_path = f"/video/main.mp4?v={timestamp}"
    width, height, fps = metadata(directory)
    return render_template("editor.html", video_path=video_path, width=width, height=height, fps=fps)

@app.route("/process_video", methods=["POST"])
def process_video():
    data = request.get_json()
    anchor1 = data.get("anchor1")
    anchor2 = data.get("anchor2")
    video_filename = data.get("video").split('/')[-1]  # Extract filename from path
    base_filename = video_filename.rsplit('.', 1)[0]  # Remove extension
    timestamp = int(time.time())
    source_to_trim = os.path.join(temp_dir.name, f"{base_filename}.mp4")
    output_name_without_digits = ''.join([char for char in base_filename if not char.isdigit()])
    output_from_trim = os.path.join(temp_dir.name, f"{output_name_without_digits}{timestamp}.mp4")
    if not os.path.exists(source_to_trim):
        return jsonify({'error': 'Source video does not exist'})
    push_current_state_to_undo(source_to_trim)
    trim(source_to_trim, anchor1, anchor2, output_from_trim)
    response_data = {"output": "/video/" + os.path.basename(output_from_trim)}
    return jsonify(response_data)

@app.route('/video/<filename>')
def video(filename):
    cache_buster = request.args.get('v', '')
    return send_from_directory(temp_dir.name, filename)

if __name__ == '__main__':
    stream = StringIO()
    with redirect_stdout(stream):
        exit_api = type('API', (object,), {'close_window': close_window})
        exit_api_instance = exit_api()
        window = webview.create_window('katcut', app, width=800, height=700, frameless=False, easy_drag=False, js_api=exit_api_instance)
        webview.start(debug=True)
