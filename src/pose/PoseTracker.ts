import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { EmaPoint } from "./smoothing";

const NOSE = 0;
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;
const L_KNEE = 25;
const R_KNEE = 26;
const L_ANKLE = 27;
const R_ANKLE = 28;

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export type Point = { x: number; y: number; visibility: number };

export type PoseFrame = {
  landmarks: NormalizedLandmark[];
  nose: Point;
  hip: Point;
  torso: Point;
  leftHip: Point;
  rightHip: Point;
  leftKnee: Point;
  rightKnee: Point;
  leftAnkle: Point;
  rightAnkle: Point;
  leftShoulder: Point;
  rightShoulder: Point;
  shoulderWidth: number;
  visible: boolean;
  hasLowerBody: boolean;
  timestamp: number;
};

export class PoseTracker {
  private landmarker: PoseLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private lastTimestamp = 0;
  private readonly nose = new EmaPoint(0.5);
  private readonly leftHip = new EmaPoint(0.5);
  private readonly rightHip = new EmaPoint(0.5);
  private readonly leftAnkle = new EmaPoint(0.5);
  private readonly rightAnkle = new EmaPoint(0.5);
  private readonly leftKnee = new EmaPoint(0.5);
  private readonly rightKnee = new EmaPoint(0.5);
  private readonly leftShoulder = new EmaPoint(0.5);
  private readonly rightShoulder = new EmaPoint(0.5);

  private live = false;

  get ready(): boolean {
    return this.live && this.landmarker !== null;
  }

  async start(video: HTMLVideoElement): Promise<void> {
    this.video = video;
    this.stopCamera();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();
    this.live = true;
    if (!this.landmarker) this.landmarker = await this.createLandmarker();
  }

  detect(now: number): PoseFrame | null {
    const video = this.video;
    const landmarker = this.landmarker;
    if (!this.live || !video || !landmarker || video.readyState < 2 || video.videoWidth < 16) return null;
    const ts = Math.floor(now);
    if (ts <= this.lastTimestamp) return null;

    try {
      const result = landmarker.detectForVideo(video, ts);
      this.lastTimestamp = ts;
      const pose = result.landmarks[0];
      if (!pose) return null;
      return this.toFrame(pose, ts);
    } catch {
      this.lastTimestamp = ts;
      return null;
    }
  }

  drawSkeleton(canvas: HTMLCanvasElement, frame: PoseFrame | null): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    if (!frame) return;

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#4cc3ff";
    ctx.fillStyle = "#e8edf5";
    for (const conn of PoseLandmarker.POSE_CONNECTIONS) {
      const a = frame.landmarks[conn.start];
      const b = frame.landmarks[conn.end];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x * width, a.y * height);
      ctx.lineTo(b.x * width, b.y * height);
      ctx.stroke();
    }
    for (const lm of frame.landmarks) {
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  stopCamera(): void {
    const stream = this.video?.srcObject;
    if (stream instanceof MediaStream) {
      for (const track of stream.getTracks()) track.stop();
    }
    if (this.video) this.video.srcObject = null;
    this.live = false;
  }

  stop(): void {
    this.stopCamera();
    this.landmarker?.close();
    this.landmarker = null;
  }

  private async createLandmarker(): Promise<PoseLandmarker> {
    const wasmPaths = [
      `${window.location.origin}/mediapipe/wasm`,
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
    ];
    let lastError: unknown;
    for (const wasm of wasmPaths) {
      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          const vision = await FilesetResolver.forVisionTasks(wasm);
          return await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.4,
            minPosePresenceConfidence: 0.4,
            minTrackingConfidence: 0.4,
          });
        } catch (error) {
          lastError = error;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Pose model failed to load");
  }

  private toFrame(landmarks: NormalizedLandmark[], timestamp: number): PoseFrame {
    const mirrored = landmarks.map((lm) => ({ ...lm, x: 1 - lm.x }));
    const point = (index: number, filter: EmaPoint): Point => {
      const lm = mirrored[index];
      const smoothed = filter.next(lm.x, lm.y);
      return { ...smoothed, visibility: lm.visibility ?? 0 };
    };

    const leftShoulder = point(L_SHOULDER, this.leftShoulder);
    const rightShoulder = point(R_SHOULDER, this.rightShoulder);
    const leftHip = point(L_HIP, this.leftHip);
    const rightHip = point(R_HIP, this.rightHip);
    const hip = mid(leftHip, rightHip);
    const torso = mid(leftShoulder, rightShoulder);
    const frame: PoseFrame = {
      landmarks: mirrored,
      nose: point(NOSE, this.nose),
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      hip,
      torso,
      leftKnee: point(L_KNEE, this.leftKnee),
      rightKnee: point(R_KNEE, this.rightKnee),
      leftAnkle: point(L_ANKLE, this.leftAnkle),
      rightAnkle: point(R_ANKLE, this.rightAnkle),
      shoulderWidth: Math.abs(leftShoulder.x - rightShoulder.x),
      visible: usable(leftShoulder, rightShoulder, hip),
      hasLowerBody: visibleEnough(leftHip) && visibleEnough(rightHip),
      timestamp,
    };
    return frame;
  }
}

function mid(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility, b.visibility),
  };
}

function visibleEnough(point: Point): boolean {
  return point.visibility === 0 || point.visibility > 0.35;
}

function usable(leftShoulder: Point, rightShoulder: Point, _hip: Point): boolean {
  return visibleEnough(leftShoulder) && visibleEnough(rightShoulder);
}
