import os
from ctypes import windll, Structure, c_long, byref
import time
import webview
from flask import session, request, jsonify
from cat_ffmpeg import screenshot, render
from cat_tools import logging

logger = logging.getLogger(__name__)

# pywebview api
SPI_GETWORKAREA = 48
class RECT(Structure):
    _fields_ = [("left", c_long),
                ("top", c_long),
                ("right", c_long),
                ("bottom", c_long)]

class API:
    def __init__(self):
        self.is_maximized = False
        self.previous_size = None
        self.previous_position = None

    def window_minimize(self):
        webview.windows[0].minimize()

    def window_maximize(self):
        if not self.is_maximized:
            # Store the current size and position
            self.previous_size = (webview.windows[0].width, webview.windows[0].height)
            self.previous_position = (webview.windows[0].x, webview.windows[0].y)

            # Get work area size and set window size
            rect = RECT()
            windll.user32.SystemParametersInfoA(SPI_GETWORKAREA, 0, byref(rect), 0)
            width = rect.right - rect.left
            height = rect.bottom - rect.top
            webview.windows[0].resize(width, height)
            webview.windows[0].move(rect.left, rect.top)
            self.is_maximized = True
        else:
            # Restore the previous size and position
            if self.previous_size and self.previous_position:
                webview.windows[0].resize(*self.previous_size)
                webview.windows[0].move(*self.previous_position)
            self.is_maximized = False

    def restore_previous_size(self):
        if self.is_maximized:
            if self.previous_size and self.previous_position:
                logger.info("doinit3")
                webview.windows[0].resize(*self.previous_size)
                webview.windows[0].move(*self.previous_position)
            self.is_maximized = False

    def window_close(self):
        webview.windows[0].destroy()

    def resizedrag(self):
        resizewindow(webview.windows[0])

    def save_screenshot(self, timestamp):
        source = session.get("current_src")
        if not source:
            return "Source not set in session", 400

        initial_directory = session.get('last_directory', "")
        save_path = webview.windows[0].create_file_dialog(webview.SAVE_DIALOG, directory=initial_directory, save_filename='screenshot.png')
        if save_path:
            session['last_directory'] = os.path.dirname(save_path)
            screenshot(source, timestamp, save_path)
            return save_path
        return None

    def render_video(self, data):
        data = request.get_json()
        extension = data.get("extension")
        targetsize = data.get("targetsize")
        resolution = data.get("resolution")
        framerate = data.get("framerate")
        quality = data.get("quality")
        source = session.get("current_src")
        target_filename = data.get("target_filename")
        initial_directory = session.get('last_directory', "")
        save_path = webview.windows[0].create_file_dialog(webview.SAVE_DIALOG, directory=initial_directory, save_filename=target_filename)
        if save_path:
            render(src=source, ext=extension, qual=quality, size=targetsize, res=resolution, fps=framerate, out=save_path)
            return save_path
        else:
            return None




# drag to resize
class POINT(Structure):
    _fields_ = [("x", c_long), ("y", c_long)]

def mousepos():
    pt = POINT()
    windll.user32.GetCursorPos(byref(pt))
    return {"x": pt.x, "y": pt.y}

def resizewindow(window):
    lmb = 0x01
    initial_button_state = windll.user32.GetKeyState(lmb)
    initial_width = window.width
    initial_height = window.height
    initial_mouse_position = mousepos()

    while True:
        current_button_state = windll.user32.GetKeyState(lmb)
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
                logger.info('[doresize]: failed to calculate position changes')
        time.sleep(0.01)
