import os
from datetime import datetime

current_time = datetime.now().strftime("%Y%m%d%H%M%S")
current_time = "20240415175703"

main_video_path = f"static/main{current_time}.mp4"
print(f"does {main_video_path} exist?")
if os.path.exists(main_video_path):
    print("does")
else:
    print("noes")

