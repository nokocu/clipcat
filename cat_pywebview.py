from webview.dom import DOMEventHandler
from ctypes import windll, Structure, c_long, byref
import time
import webview
from cat_tools import logger


# pywebview api
class API:
    def window_minimize(self):
        webview.windows[0].minimize()

    def window_maximize(self):
        webview.windows[0].toggle_fullscreen()

    def window_close(self):
        webview.windows[0].destroy()

    def resizedrag(self):
        resizewindow(webview.windows[0])

# drag to upload
def bind(window):
    window.dom.document.events.dragover += DOMEventHandler(on_drag, True, True)
    window.dom.document.events.drop += DOMEventHandler(on_drop, True, True)

def on_drag(e):
    pass

def on_drop(e):
    files = e['dataTransfer']['files']
    if len(files) == 0:
        return
    logger.info(f'[on_drop] Event: {e["type"]}. Dropped files:')
    for file in files:
        logger.info(f"[on_drop] {file.get('pywebviewFullPath')}")


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