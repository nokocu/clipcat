import json

from flask import Flask, request, render_template, jsonify
from io import StringIO
from contextlib import redirect_stdout
import webview
import os
import logging
import subprocess
import tempfile
from datetime import datetime


# flask
app = Flask(__name__)

# logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# tools - concat
def concat(source_1, source_2, destination):

    # creates temporary directory for temporary fires
    with tempfile.TemporaryDirectory() as tmp_dir:
        temp_txt_path = tempfile.NamedTemporaryFile(mode='w', dir=tmp_dir, delete=False).name

        # lists both files to merge in txt, ffmpeg concat requirement
        with open(temp_txt_path, 'w') as temp_txt:
            temp_txt.write(f"file '{source_1}'\n")
            temp_txt.write(f"file '{source_2}'\n")

        # merges files
        command = ["ffmpeg", "-y", "-safe", "0", "-f", "concat", "-i", f"concat:{temp_txt_path}", "-c", "copy", destination, "-loglevel", "error"]
        subprocess.run(command)

# tools - trimming
def trim(source, a, b, destination):

    # hotfix
    if a == "00:00.000":
        a = "00:00.001"
    if b == "00:00.000":
        b = "00:00.001"

    # creates temporary directory for temporary fires
    with tempfile.TemporaryDirectory() as tmp_dir:
        temp_a_path = tempfile.NamedTemporaryFile(suffix='.mp4', dir=tmp_dir, delete=False).name
        temp_b_path = tempfile.NamedTemporaryFile(suffix='.mp4', dir=tmp_dir, delete=False).name

        # clips from start to point A
        command = ["ffmpeg", "-ss", "0", "-to", a, "-i", source, "-c", "copy", temp_a_path, "-y", "-loglevel", "error"]
        subprocess.run(command)

        # clips from point B to the end
        command = ["ffmpeg", "-ss", b, "-to", "999999999", "-i", source, "-c", "copy", temp_b_path, "-y", "-loglevel", "error"]
        subprocess.run(command)

        # concats both videos
        concat(temp_a_path, temp_b_path, destination)

# variables
directory = "static/main0.mp4"
current_edit = 0

@app.route('/')
def home():
    return render_template("index.html")

@app.route('/editor', methods=['GET', 'POST'])
def editor():

    if request.method == 'POST':
        if 'video_file' in request.files:
            video = request.files['video_file']
            video.save(directory)
            logger.info("Video saved at: %s", directory)
            return render_template("editor.html", video_path=directory)
        else:
            logger.info("logging that else was triggered")
            return jsonify({'error': 'No file received'})
    return render_template("editor.html", video_path=directory)


@app.route("/process_video", methods=["POST"])
def process_video():
    # this is ugly
    global current_edit
    current_edit += 1

    # get the data
    data = request.get_json()
    source = data.get("video")
    anchor1 = data.get("anchor1")
    anchor2 = data.get("anchor2")

    # trim the video
    trimsrc = os.getcwd().replace("\\", "/")
    main_video_path = f"static/main{current_edit}.mp4"
    main_last_video_path = f"static/main_last.mp4"
    temp_main_video_path = f"static/temp_main.mp4"
    trim(trimsrc + "/" + source, anchor1, anchor2, temp_main_video_path)

    # check if main_last.mp4 exists and delete it if it does
    if os.path.exists(main_last_video_path):
        os.remove(main_last_video_path)

    # rename existing main video to main_last if it exists
    if os.path.exists(main_video_path):
        os.rename(main_video_path, main_last_video_path)
    elif os.path.exists(directory):
        os.rename(directory, main_last_video_path)
    elif os.path.exists(f"static/main{current_edit-1}.mp4"):
        os.rename(f"static/main{current_edit-1}.mp4", main_last_video_path)

    # Rename temporary main video to main
    os.rename(temp_main_video_path, main_video_path)

    # Prepare the response object
    response_data = {"output": "/" + main_video_path}

    # Convert the response object to JSON
    return json.dumps(response_data)

@app.route("/swap_files", methods=["POST"])
def swap_files():
    # logic to swap file names
    main_video_path = f"static/main{current_edit}.mp4"
    main_last_video_path = f"static/main_last.mp4"
    temp_main_video_path = "static/temp_main.mp4"

    if os.path.exists(main_video_path) and os.path.exists(main_last_video_path):
        os.rename(main_video_path, temp_main_video_path)
        os.rename(main_last_video_path, main_video_path)
        os.rename(temp_main_video_path, main_last_video_path)

        logger.info("Files swapped successfully")
        response_data = {"output": "/" + main_video_path}
        return json.dumps(response_data)

    else:
        logger.info("Error: Files not found")
        response_data = {"output": "/" + main_video_path}
        return json.dumps(response_data)


if __name__ == '__main__':
    stream = StringIO()
    with redirect_stdout(stream):
        window = webview.create_window('Valorant 2023.12.19 - 22.27.48.02.DVR - nanocut', app,
                                       width=800, height=700, frameless=False, easy_drag=False)
        webview.start(debug=True)


