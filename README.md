# Tunnel Dash

Webcam pose controls a 3-lane endless runner. Lean left or right to change lanes, hop to jump, and squat to slide.

## Run

```bash
npm install
npm run dev
```

Open the local Vite URL, then use **Start**, **Pause**, and **End**.

- **Start** turns the camera on and begins a run
- **Pause** freezes the run and stops the camera
- **End** resets the session and stops the camera
- Arrow keys / WASD still work as a fallback

Stand so your shoulders are in frame, hold still for auto-calibration, then move.

## Stack

Vite, TypeScript, Phaser 3, and MediaPipe Pose Landmarker in the browser.
