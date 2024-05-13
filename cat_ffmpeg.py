from flask import session
from pymediainfo import MediaInfo
import os
import subprocess
import time
from cat_tools import temp_dir_path, removing, combine_masks, logging

logger = logging.getLogger(__name__)

# ffmpeg path, hide subprocess cmd
ffmpeg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dependencies/ffmpeg.exe')
si = subprocess.STARTUPINFO()
si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
si.wShowWindow = subprocess.SW_HIDE


# concatenating
def concat(sources, destination):
    temp_txt_path = os.path.join(os.path.dirname(destination), "temp_concat_list.txt")
    with open(temp_txt_path, 'w', encoding='utf-8') as temp_txt:
        for source in sources:
            logger.info(f"{source=}")
            temp_txt.write(f"file '{source.replace(os.sep, '/')}'\n")
    cmd = [ffmpeg_path, "-y", "-safe", "0", "-f", "concat", "-i", temp_txt_path, "-c", "copy", destination, "-loglevel", "error"]
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        logger.info(f"[concat] Error during ffmpeg processing: {e}")
        return False
    finally:
        os.remove(temp_txt_path)
        pass
    return True

# trimming
def trim(source, a, b, destination, video_length):
    source_ext = os.path.splitext(source)[1]
    temp_a_path = os.path.join(temp_dir_path, f"temp_a{source_ext}")
    temp_b_path = os.path.join(temp_dir_path, f"temp_b{source_ext}")
    if a > b:
        a, b = b, a

    if b == video_length:
        cmd = [ffmpeg_path, "-ss", "0", "-to", a, "-i", source, "-c", "copy", destination, "-y", "-loglevel", "error"]
        subprocess.run(cmd, startupinfo=si)
    elif a != "00:00.000":
        cmd = [ffmpeg_path, "-ss", "0", "-to", a, "-i", source, "-c", "copy", temp_a_path, "-y", "-loglevel", "error"]
        subprocess.run(cmd, startupinfo=si)
        cmd = [ffmpeg_path, "-ss", b, "-to", "999999999", "-i", source, "-c", "copy", temp_b_path, "-y", "-loglevel", "error"]
        subprocess.run(cmd, startupinfo=si)
        concat([temp_a_path, temp_b_path], destination)
        removing(temp_a_path)
        removing(temp_b_path)
    elif a == "00:00.000":
        cmd = [ffmpeg_path, "-ss", b, "-to", "999999999", "-i", source, "-c", "copy", destination, "-y", "-loglevel", "error"]
        subprocess.run(cmd, startupinfo=si)

    session["current_src"] = destination


# metadata grabbing
def metadata(video_path):
    media_info = MediaInfo.parse(video_path)
    for track in media_info.tracks:
        if track.track_type == 'Video':
            width = track.width
            height = track.height
            fps = track.frame_rate
            return width, height, float(fps)


# rendering
def render(src, ext, qual, size, res, fps, out=None):
    start_time = time.time()
    logger.info("[render]: starting")
    os.environ['SVT_LOG'] = 'error'
    src_path, src_ext = os.path.splitext(src)
    if not out:
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
            media_info = MediaInfo.parse(src)
            current_resolution = None
            for track in media_info.tracks:
                if track.track_type == 'Video':
                    current_width = track.width
                    current_height = track.height
                    current_resolution = f"{current_width}x{current_height}"
                    break

            if current_resolution != res:
                max_res = (7680, 4320)
                min_res = (1, 1)
                width, height = map(int, res.split('x'))
                width = max(min(width, max_res[0]), min_res[0])
                height = max(min(height, max_res[1]), min_res[1])
                cmd.extend(['-s', f"{width}x{height}"])
            else:
                cmd.extend(['-c', 'copy'])
        except ValueError:
            cmd.extend(['-c', 'copy'])

    cmd.append(out)
    logger.info(f"[render] {ext=}, {size=}, {res=}, {fps=}")
    logger.info(f"[render]: executing: ({' '.join(cmd)})")
    subprocess.run(cmd, startupinfo=si)
    elapsed_time = time.time() - start_time
    logger.info(f"[render]: finished in {elapsed_time:.2f} seconds.")


# extraction of audio for waveforms
def extract_audio(video_path):
    audio_path = os.path.join(temp_dir_path, "temp_audio.wav")
    cmd = [ffmpeg_path, '-i', video_path, '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '1', audio_path, '-y', '-v', "error"]
    subprocess.run(cmd, startupinfo=si)
    return audio_path

# screenshoting
def screenshot(source, timestamp, destination):
    cmd = [
        ffmpeg_path,
        '-ss', timestamp,
        '-i', source,
        '-frames:v', '1',
        '-compression_level', '0',
        destination,
        '-y',
        '-loglevel', 'error',
    ]

    try:
        subprocess.run(cmd, startupinfo=si)
        return destination
    except subprocess.CalledProcessError as e:
        return False


# (wip) effects - blur
def blur_video(input_video, output_video, ffmpeg_path, combined_mask_path, areas, filter_type='median', filter_strength=5):
    if filter_type == 'gaussian':
        ffmpeg_filter = f"gblur=sigma={filter_strength}"
    elif filter_type == 'box':
        ffmpeg_filter = f"boxblur=luma_radius={filter_strength}:luma_power=1"
    elif filter_type == 'median':
        ffmpeg_filter = f"median={filter_strength}"

    filter_complex = f"""
    [0:v]split=2[original][toBlur];
    [toBlur]{ffmpeg_filter}[blurred];
    [1:v]format=gray,geq=lum='p(X,Y)':a=0[alpha];
    [blurred][alpha]alphamerge[blurredAlpha];
    [original][blurredAlpha]overlay[v]
    """

    command = [
        ffmpeg_path, '-y', '-i', input_video, '-i', combined_mask_path,
        '-filter_complex', filter_complex, '-map', '[v]', '-map', '0:a',
        '-c:v', 'libx264', '-c:a', 'copy', '-movflags', '+faststart', output_video
    ]

    subprocess.run(command, check=True)

if __name__ == "__main__":
    input_video = "video43.mp4"
    output_video = "output.mp4"
    ffmpeg_path = "ffmpeg.exe"
    masks_path = "masks/"
    combined_mask_path = "combined_mask.png"
    aspect_ratio = "4:3"  # or "16:9"
    filter_type = 'median'  # choose 'gaussian', 'box', 'median'
    filter_strength = 10
    areas = {
        "minimap": {"Enabled": False, "EdgeSoftness": 0},
        "topleft": {"Enabled": False, "EdgeSoftness": 0},
        "topright": {"Enabled": False, "EdgeSoftness": 0},
        "killfeed": {"Enabled": True, "EdgeSoftness": 10}
    }

    combine_masks(masks_path, combined_mask_path, areas, aspect_ratio, filter_type)
    blur_video(input_video, output_video, ffmpeg_path, combined_mask_path, areas, filter_type, filter_strength)