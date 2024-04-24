from flask import Flask, request, render_template, jsonify
from tools import *
import os

server = Flask(__name__)
directory = os.getcwd().replace("\\", "/")


@server.route('/')
def editor():
    return render_template("editor.html")


@server.route("/process_video", methods=["POST"])
def process_video():
    # Extract data from the request payload
    data = request.get_json()
    source = data.get("videoSource")
    anchor1 = data.get("anchor1")
    anchor2 = data.get("anchor2")
    # print(f"data: {anchor1}, {anchor2}, {source}")
    trim(f"{directory}/{source}", anchor1, anchor2, f"{directory}/output/C.mp4")
    return jsonify({"message": "Video processed successfully", "anchor1": anchor1, "anchor2": anchor2})