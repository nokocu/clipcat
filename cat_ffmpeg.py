from flask import session
from pymediainfo import MediaInfo
import os
import subprocess
import time
from cat_tools import temp_dir_path, removing
from cat_tools import logger
import re
ffmpeg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ffmpeg/ffmpeg.exe')


# concatenating
def concat(source_1, source_2, destination):
    temp_txt_path = os.path.join(temp_dir_path, "temp_concat_list.txt")
    with open(temp_txt_path, 'w') as temp_txt:
        temp_txt.write(f"file '{source_1}'\n")
        temp_txt.write(f"file '{source_2}'\n")
    command = [ffmpeg_path, "-y", "-safe", "0", "-f", "concat", "-i", temp_txt_path, "-c", "copy", destination, "-loglevel", "error"]
    subprocess.run(command)
    removing(temp_txt_path)


# trimming
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


# metadata grabbing
def metadata(video_path):
    try:
        media_info = MediaInfo.parse(video_path)
        for track in media_info.tracks:
            if track.track_type == 'Video':
                width = track.width
                height = track.height
                fps = track.frame_rate
                return width, height, float(fps)

    except Exception as e:
        logger.error(f"[metadata] Failed to extract video metadata: {str(e)}")
        return "Unknown", "Unknown", "Unknown"


# rendering
def render(src, ext, qual, size, res, fps):
    start_time = time.time()
    logger.info("[render]: starting")
    os.environ['SVT_LOG'] = 'error'
    src_path, src_ext = os.path.splitext(src)
    out0 = os.path.join(temp_dir_path, f"render.")
    out = f'{out0}' + (src_ext[1:] if ext == "copy" else ext[1:])
    session['rendered_vid'] = out
    cmd = [ffmpeg_path, '-y', '-i', src, '-threads', '0', "-v", "error"]

    # preset translator
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
        cmd.extend(['-c:v', 'libx264', '-preset', preset_handler(qual, "libx264"), '-c:a', 'libopus'])
    else:
        cmd.extend(['-c', 'copy'])
        ext = src_ext

    # filesize changer
    if size != "copy":

        if "mb" in size.lower():
            size = size.replace('mb', '')
        elif "gb" in size.lower():
            size = int(size.replace('gb', '')) * 1024
        logger.info(f"size is {size=}")
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


# extraction of audio for waveforms
def extract_audio(video_path):
    audio_path = os.path.join(temp_dir_path, "temp_audio.wav")
    logger.info(f"[extract_audio] {video_path=} ")
    logger.info(f"[extract_audio] {audio_path=} ")
    logger.info(f"[extract_audio] {ffmpeg_path=} ")
    command = [ffmpeg_path, '-i', video_path, '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '1', audio_path, '-y', '-v', "error"]
    subprocess.run(command)
    return audio_path
