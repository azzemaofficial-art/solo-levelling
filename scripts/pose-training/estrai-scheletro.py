# Estrae lo scheletro (33 punti MediaPipe, 2D + 3D) da un video, fotogramma per fotogramma.
# Uso: python estrai-scheletro.py video.mp4 out.json [heavy|full|lite] [fps_max] [lato_max_px] [video|image]
# image = ogni fotogramma letto da solo (niente inseguimento né levigatura interna): serve al "maestro".
# fps_max / lato_max_px servono a imitare il telefono (meno fotogrammi, immagine più piccola).
import sys, json, os, urllib.request
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

MODELS = {
    'heavy': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
    'full': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
    'lite': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
}
HERE = os.path.dirname(os.path.abspath(__file__))


def model_path(name):
    p = os.path.join(os.path.expanduser('~'), '.cache', 'mediapipe-models', f'pose_landmarker_{name}.task')
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        urllib.request.urlretrieve(MODELS[name], p)
    return p


def main():
    src, out = sys.argv[1], sys.argv[2]
    name = sys.argv[3] if len(sys.argv) > 3 else 'heavy'
    fps_max = float(sys.argv[4]) if len(sys.argv) > 4 else 0
    side_max = int(sys.argv[5]) if len(sys.argv) > 5 else 0
    image_mode = len(sys.argv) > 6 and sys.argv[6] == 'image'
    cap = cv2.VideoCapture(src)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    opts = vision.PoseLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=model_path(name), delegate=mpt.BaseOptions.Delegate.CPU),
        running_mode=vision.RunningMode.IMAGE if image_mode else vision.RunningMode.VIDEO, num_poses=1,
        min_pose_detection_confidence=0.5, min_pose_presence_confidence=0.5, min_tracking_confidence=0.5)
    det = vision.PoseLandmarker.create_from_options(opts)
    frames, i, next_t = [], 0, 0.0
    step = 1000.0 / fps_max if fps_max else 0
    while True:
        ok, img = cap.read()
        if not ok:
            break
        t = i * 1000.0 / fps
        i += 1
        if step and t + 1e-6 < next_t:
            continue
        next_t += step
        if side_max and max(W, H) > side_max:
            k = side_max / max(W, H)
            img = cv2.resize(img, (int(W * k), int(H * k)), interpolation=cv2.INTER_AREA)
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        im = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        res = det.detect(im) if image_mode else det.detect_for_video(im, int(t))
        if not res.pose_landmarks:
            frames.append({'t': round(t), 'p': None})
            continue
        p = [[round(l.x, 4), round(l.y, 4), round(l.visibility, 3)] for l in res.pose_landmarks[0]]
        w = [[round(l.x, 4), round(l.y, 4), round(l.z, 4)] for l in res.pose_world_landmarks[0]]
        frames.append({'t': round(t), 'p': p, 'w': w})
    det.close()
    with open(out, 'w') as f:
        json.dump({'src': os.path.basename(src), 'model': name, 'mode': 'image' if image_mode else 'video', 'fps': fps, 'w': W, 'h': H, 'aspect': W / H, 'frames': frames}, f)
    seen = sum(1 for fr in frames if fr['p'])
    print(f'{os.path.basename(src)}: {len(frames)} fotogrammi, persona vista in {seen}')


if __name__ == '__main__':
    main()
