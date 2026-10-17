# Legge un video BoxingVI come fa il telefono: MediaPipe Pose Lite, 25 fotogrammi al secondo,
# immagine di 640 px, modalità "video" (insegue la persona da un fotogramma all'altro).
# Scarica il video da YouTube, lo legge solo nel tratto con i pugni etichettati (al massimo MAX_MIN
# minuti, default 6) e lo CANCELLA.
# Uso: python -I estrai-video.py <V> <boxingvi-pugni.json.gz> <cartella_uscita> <cartella_video>
# Serve mediapipe==0.10.21 (Python 3.11), yt-dlp, ffmpeg. Un solo video alla volta.
import sys, os, json, gzip, subprocess, urllib.request
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

LITE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
J = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
# 640 px e 25 fps regolari: come la catena del telefono dal 17/10 (prima 960 px)
SIDE, FPS = int(os.environ.get('SIDE', 640)), 25
MAX_MIN = float(os.environ.get('MAX_MIN', 6))


def model_path():
    p = os.path.join(os.path.expanduser('~'), '.cache', 'mediapipe-models', 'pose_landmarker_lite.task')
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        urllib.request.urlretrieve(LITE, p)
    return p


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', path], capture_output=True, text=True, check=True)
    s = json.loads(out.stdout)['streams'][0]
    a, b = s['r_frame_rate'].split('/')
    return int(s['width']), int(s['height']), float(a) / float(b)


def main():
    v, labels_file, out_dir, vid_dir = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
    data = json.load(gzip.open(labels_file, 'rt'))
    info = next(x for x in data['videos'] if x['v'] == v)
    os.makedirs(out_dir, exist_ok=True); os.makedirs(vid_dir, exist_ok=True)
    video = os.path.join(vid_dir, f'V{v}.mp4')
    if not os.path.exists(video):
        subprocess.run(['yt-dlp', '--js-runtimes', 'node', '-q', '--no-warnings', '-f', 'bv*[height<=720][ext=mp4]/bv*[height<=720]', '-o', video, f"https://www.youtube.com/watch?v={info['yt']}"], check=True)
    W, H, fps = probe(video)
    k = min(1.0, SIDE / max(W, H))
    w, h = int(round(W * k / 2) * 2), int(round(H * k / 2) * 2)
    starts = sorted(p['s'] / fps for p in info['punches'])
    s0, s1 = starts[0] - 20, max(p['e'] for p in info['punches']) / fps + 5
    # al massimo MAX_MIN minuti: il tratto con più pugni etichettati (il Mac è lento, bastano)
    if s1 - s0 > MAX_MIN * 60:
        best = max(starts, key=lambda a: sum(1 for b in starts if a <= b < a + MAX_MIN * 60 - 25))
        s0, s1 = best - 20, best - 20 + MAX_MIN * 60
    s0 = max(0.0, s0)
    out_fps = min(fps, FPS)
    vf = f'scale={w}:{h}' + (f',fps={FPS}' if fps > FPS + 0.5 else '')
    cmd = ['ffmpeg', '-v', 'error', '-ss', f'{s0:.3f}', '-i', video, '-t', f'{s1 - s0:.3f}', '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=w * h * 3 * 4)
    opts = vision.PoseLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=model_path(), delegate=mpt.BaseOptions.Delegate.CPU),
        running_mode=vision.RunningMode.VIDEO, num_poses=1,
        min_pose_detection_confidence=0.5, min_pose_presence_confidence=0.5, min_tracking_confidence=0.5)
    det = vision.PoseLandmarker.create_from_options(opts)
    frames, i = [], 0
    size = w * h * 3
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        t = i * 1000.0 / out_fps
        i += 1
        img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.frombuffer(buf, np.uint8).reshape(h, w, 3))
        res = det.detect_for_video(img, int(round(t)))
        if not res.pose_landmarks:
            frames.append([round(t)])
            continue
        lm, wl = res.pose_landmarks[0], res.pose_world_landmarks[0]
        p = [int(round(c)) for j in J for c in (lm[j].x * 1000, lm[j].y * 1000, lm[j].visibility * 100)]
        q = [int(round(c * 1000)) for j in J for c in (wl[j].x, wl[j].y, wl[j].z)]
        frames.append([round(t), p, q])
    det.close(); proc.wait()
    dest = os.path.join(out_dir, f'V{v}.json.gz')
    with gzip.open(dest, 'wt') as f:
        json.dump({'v': v, 'fps_src': fps, 'fps': out_fps, 'aspect': w / h, 'start_ms': round(s0 * 1000), 'side': SIDE, 'j': J, 'frames': frames}, f, separators=(',', ':'))
    seen = sum(1 for fr in frames if len(fr) > 1)
    print(f'V{v}: {len(frames)} fotogrammi ({fps:.3f} fps, {W}x{H}), persona vista in {seen}')
    os.remove(video)


if __name__ == '__main__':
    main()
