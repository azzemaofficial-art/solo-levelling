# MMA Coach Studio

Entry: MMA Academy → Coach Studio. The studio is lazy-loaded independently of the legacy multi-discipline Coach. Telegram integration is unchanged.

## Components

- `MmaProCoach.jsx`: setup, calibration, warmup, rounds, rest, pause, report, reflection.
- `MmaTechnique.jsx`: explicitly schematic, step-selectable illustrations; never presented as expert video.
- `useMmaCamera.js`: camera lifecycle, failure handling and throttled frame delivery.
- `mmaPose.worker.js`: pinned MediaPipe 0.10.18, CPU inference in a classic dedicated worker. Keep the worker classic: this version's WASM loader calls `importScripts`, which fails inside a module worker.
- `mmaCoachEngine.js`: browser-independent observation and session state machines.
- `mmaCoachStorage.js`: bounded local history, preserves existing Academy data.

## Observation rules

Confidence threshold 0.65, in-frame upper-body joints; calibration additionally requires both feet, a stable guard and an upright torso for two continuous seconds. Image aspect ratio is applied before angle calculations.

Slow straight punches require a guard, confirmed extension and stable return. A single noisy extension frame cannot count. The anatomical lead arm is selected by the user, independently of mirrored video. A 1–2 requires a lead-to-rear order with temporally separate returns. Lost landmarks, long frame gaps and pauses discard partial gestures.

These are **unvalidated 2D heuristics**, not a professional technique grade. They do not measure fist alignment, impact, power, tactical quality or 3D joint mechanics. Kicks are guided without a technique score; sprawls and clinch use guided mode only.

Frame processing occurs locally. No recording or image uploads. The browser downloads MediaPipe code, WASM and model assets. The studio has no metered AI calls.

## Timing and records

- 3-minute guided warmup unless already warmed up; 5-second preparation.
- Lesson-specific rounds, 60-second rests; short session is 2 × 60 seconds.
- Pause on background, stalled video or sustained tracking loss; explicit resume.
- Report uses actual work and observed time, not elapsed time in setup/rest.
- A session with under 15 seconds of work is not persisted.
- Camera practice is marked only after a completed round, 30 seconds of work, at least 15 seconds observed, and at least 50% coverage.
- Guided practice is labeled as guided and never gets camera metrics.
- Reflections and effort are user-reported; high effort within 48 hours suggests the short session.

## Validation

`node --test tests/mmaCoach.test.js`: calibration, occlusion, image aspect ratio, cycle completion, handedness, ordering, noise, frame gaps, pauses, timers and storage.

Browser checks: model loads and processes a synthetic empty frame in the worker; guided countdown, pause/resume, report and discard; desktop and 390-pixel layouts. No camera permission was granted and no real-person tracking accuracy is claimed. Real-device trials in varied light, framing and stance remain necessary before relaxing detection thresholds.

References are linked in the studio's “Metodo e limiti” panel: England Boxing coaching handbook (basic striking) and Google's Pose Landmarker documentation.
