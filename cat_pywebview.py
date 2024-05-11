import webbrowser
from ctypes import windll, Structure, c_long, byref
import time
import webview
from cat_tools import logger
import webview.platforms.edgechromium as edgechromium
import webview.platforms.winforms as winforms

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


# Monkeypatch for pywebview, that launches browser if WebView2 was uninstalled from Windows11
class CustomEdgeChrome(edgechromium.EdgeChrome):
    def on_webview_ready(self, sender, args):
        if not args.IsSuccess:
            browser_mode()
            logger.error('WebView2 initialization failed with exception:\n' + str(args.InitializationException))
            return
        else:
            super().on_webview_ready(sender, args)


def browser_mode():
    webbrowser.open_new("http://127.0.0.1:1337/")

edgechromium.EdgeChrome = CustomEdgeChrome
