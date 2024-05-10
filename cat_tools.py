import tempfile
from flask import session
from PIL import Image, ImageDraw
from math import log
import os
import time
import wave
import base64
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
temp_dir_path = os.path.join(tempfile.gettempdir(), "temp_nkc")
os.makedirs(temp_dir_path, exist_ok=True)


def push_current_state_to_undo(video_path):
    if len(session['undo_stack']) >= 4:
        oldest_path = session['undo_stack'].pop(0)
        if oldest_path not in session['redo_stack']:
            removing(oldest_path)
    session['undo_stack'].append(video_path)
    session.modified = True

def push_current_state_to_redo(video_path):
    if len(session['redo_stack']) >= 4:
        oldest_path = session['redo_stack'].pop(0)
        if oldest_path not in session['undo_stack']:
            removing(oldest_path)
    session['redo_stack'].append(video_path)
    session.modified = True


def cleanup_temp_dir():
    for filename in os.listdir(temp_dir_path):
        file_path = os.path.join(temp_dir_path, filename)
        if os.path.isfile(file_path):
            removing(file_path)


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


def log_stack(where=""):
    try:
        logger.info(f"[log_stack] @ {where} Undo Stack: {session['undo_stack']}")
    except KeyError:
        logger.info(f"[log_stack] @ {where} Undo Stack: empty")

    # try:
    #     logger.info(f"[log_stack] @ {where} Redo Stack: {session['redo_stack']}")
    # except KeyError:
    #     logger.info(f"[log_stack] @ {where} Redo Stack: empty")


def removing(path):
    while True:
        try:
            os.remove(path)
            # logger.info(f"[removing] File {path} removed successfully.")
            break
        except FileNotFoundError:
            logger.info(f"[removing] File {path} doesn't exist. Ignoring...")
            break
        except Exception as e:
            logger.error(f"[removing] Failed to remove {path}: {e}.")
            logger.error(f"[removing] Retrying...")
            time.sleep(2)
            break
