import subprocess
import tempfile
from flask import session
from PIL import Image, ImageDraw
from math import log
import os
import time
import wave
import base64
import logging
import winreg
import ctypes
import requests

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
temp_dir_path = os.path.join(tempfile.gettempdir(), "temp_nkc")
os.makedirs(temp_dir_path, exist_ok=True)

# undo
def push_current_state_to_undo(video_path):
    if len(session['undo_stack']) >= 4:
        oldest_path = session['undo_stack'].pop(0)
        if oldest_path not in session['redo_stack']:
            removing(oldest_path)
    session['undo_stack'].append(video_path)
    session.modified = True
    log_stack(where="push")


# redo
def push_current_state_to_redo(video_path):
    if len(session['redo_stack']) >= 4:
        oldest_path = session['redo_stack'].pop(0)
        if oldest_path not in session['undo_stack']:
            removing(oldest_path)
    session['redo_stack'].append(video_path)
    session.modified = True
    log_stack(where="push")


# cleanup
def cleanup_temp_dir():
    for filename in os.listdir(temp_dir_path):
        file_path = os.path.join(temp_dir_path, filename)
        if os.path.isfile(file_path):
            removing(file_path)


# waveform
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

# logging undo/redo stack
def log_stack(where=""):
    try:
        logger.info(f"[log_stack] @ {where} Undo Stack: {session['undo_stack']}")
    except KeyError:
        logger.info(f"[log_stack] @ {where} Undo Stack: empty")


# delete function
def removing(path):
    while True:
        try:
            os.remove(path)
            break
        except FileNotFoundError:
            logger.info(f"[removing] File {path} doesn't exist. Ignoring...")
            break
        except Exception as e:
            logger.error(f"[removing] Retrying removing {path}: {e}.")
            time.sleep(1)
            break


# checks if webview installed
def webview_exists():
    keys = [(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"),
            (winreg.HKEY_LOCAL_MACHINE,
             r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}")]
    edge_path = None
    for root, sub_key in keys:
        try:
            with winreg.OpenKey(root, sub_key) as key:
                value, _ = winreg.QueryValueEx(key, "SilentUninstall")
                path = value.split("Installer")[0].strip('"').rsplit("\\", 1)[0]
                edge_path = f"{path}\\msedgewebview2.exe"
                if os.path.exists(edge_path):
                    return True
        except FileNotFoundError:
            continue

    print("[webview_exists] false")
    return False

def internet_check():
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    try:
        response = requests.get('http://google.com', timeout=3)
        return True if response.status_code == 200 else False
    except requests.ConnectionError:
        return False

# installs webview
def webview_install():
    source = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dependencies\\Webview2Setup.exe')
    command = [source, '/silent', '/install']
    try:
        logger.info("[webview_install] starting")
        result = subprocess.run(command, check=True, text=True, capture_output=True)
        logger.info("[webview_install] success")
        return True
    except subprocess.CalledProcessError as e:
        logger.info(f"[webview_install] failed: {e.returncode=} {e.output=} {e.stderr=}")
        return webview_install_elevated(command)


# installs webview with elevation when normal install thinks edge is installed (corrupted files)
def webview_install_elevated(command):
    if ctypes.windll.shell32.IsUserAnAdmin():
        try:
            logger.info("[webview_install_elevated] start")
            result = subprocess.run(command, check=True, text=True, capture_output=True)
            logger.info("[webview_install_elevated] success")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"[webview_install_elevated] failed: {e.returncode=} {e.output=} {e.stderr=}")
            return False
    else:
        executable = command[0]
        parameters = ','.join(f'"{arg}"' for arg in command[1:])
        if os.name == 'nt':
            cmd = f'powershell Start-Process "{executable}" -ArgumentList {parameters} -Verb runAs -Wait'
            try:
                logger.info("[webview_install_elevated] start")
                proc = subprocess.run(cmd, shell=True, check=True, text=True, capture_output=True)
                if proc.returncode == 0:
                    logger.info("[webview_install_elevated] success as admin")
                    return True
                else:
                    logger.error(f"[webview_install_elevated] admin execution failed with return code {proc.returncode}")
                    return False
            except subprocess.CalledProcessError as e:
                logger.error(f"[webview_install_elevated] admin request failed: {e.returncode=} {e.output=} {e.stderr=}")
                return False

