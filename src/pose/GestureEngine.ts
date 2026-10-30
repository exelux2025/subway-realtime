import type { GameAction, Lane } from "../types";
import type { PoseFrame } from "./PoseTracker";

export type Calibration = {
  x: number;
  y: number;
  shoulderWidth: number;
};

export type GestureDebug = {
  hipX: number;
  hipY: number;
  hipVel: number;
  kneeAngle: number;
  lane: Lane;
  sliding: boolean;
  canJump: boolean;
  visible: boolean;
  intent: GameAction | "idle";
  offsetX: number;
};

const JUMP_VELOCITY = 0.16;
const JUMP_LIFT = 0.01;
const JUMP_COOLDOWN_MS = 420;
const DROP = 0.045;
const SLIDE_RELEASE = 0.02;
const SLIDE_HOLD_FRAMES = 4;

export class GestureEngine {
  private calibration: Calibration | null = null;
  private lane: Lane = 0;
  private prevY: number | null = null;
  private prevTime = 0;
  private lastJumpAt = -Infinity;
  private canJump = true;
  private sliding = false;
  private dropFrames = 0;
  private samples: PoseFrame[] = [];

  get calibrated(): boolean {
    return this.calibration !== null;
  }

  get currentLane(): Lane {
    return this.lane;
  }

  reset(): void {
    this.calibration = null;
    this.lane = 0;
    this.prevY = null;
    this.sliding = false;
    this.canJump = true;
    this.samples = [];
  }

  beginCalibration(): void {
    this.samples = [];
  }

  addCalibrationSample(frame: PoseFrame): void {
    if (frame.visible) this.samples.push(frame);
  }

  finishCalibration(): Calibration | null {
    if (this.samples.length < 10) return null;
    const xs = this.samples.map((f) => bodyX(f));
    const ys = this.samples.map((f) => bodyY(f));
    const widths = this.samples.map((f) => Math.max(0.08, f.shoulderWidth));
    this.calibration = {
      x: average(xs),
      y: average(ys),
      shoulderWidth: average(widths),
    };
    this.lane = 0;
    this.prevY = this.calibration.y;
    this.sliding = false;
    this.canJump = true;
    this.samples = [];
    return this.calibration;
  }

  sampleCount(): number {
    return this.samples.length;
  }

  update(frame: PoseFrame): { actions: GameAction[]; debug: GestureDebug } {
    const debug = this.debugFrom(frame);
    if (!this.calibration || !frame.visible) {
      return { actions: [], debug };
    }

    const dt = this.prevTime ? Math.max(0.008, (frame.timestamp - this.prevTime) / 1000) : 0.016;
    this.prevTime = frame.timestamp;

    const x = bodyX(frame);
    const y = bodyY(frame);
    const vel = this.prevY === null ? 0 : (this.prevY - y) / dt;
    this.prevY = y;
    debug.hipX = x;
    debug.hipY = y;
    debug.hipVel = vel;
    debug.offsetX = x - this.calibration.x;

    const actions: GameAction[] = [];
    const nextLane = this.laneFrom(x);
    if (nextLane !== this.lane) {
      const step = nextLane > this.lane ? 1 : -1;
      const action: GameAction = step > 0 ? "right" : "left";
      while (this.lane !== nextLane) {
        this.lane = (this.lane + step) as Lane;
        actions.push(action);
      }
    }
    debug.lane = this.lane;

    const dropped = y > this.calibration.y + DROP;
    this.dropFrames = dropped ? this.dropFrames + 1 : 0;
    if (this.dropFrames >= SLIDE_HOLD_FRAMES) {
      if (!this.sliding) {
        this.sliding = true;
        actions.push("slide");
      }
    } else if (this.sliding && y < this.calibration.y + SLIDE_RELEASE) {
      this.sliding = false;
      actions.push("stand");
    }
    debug.sliding = this.sliding;
    debug.kneeAngle = kneeAngle(frame);

    if (y >= this.calibration.y - JUMP_LIFT * 0.4) this.canJump = true;
    debug.canJump = this.canJump;

    const lifted = y < this.calibration.y - JUMP_LIFT;
    const cooled = frame.timestamp - this.lastJumpAt > JUMP_COOLDOWN_MS;
    if (this.canJump && cooled && !this.sliding && vel > JUMP_VELOCITY && lifted) {
      actions.push("jump");
      this.lastJumpAt = frame.timestamp;
      this.canJump = false;
    }

    debug.intent = intentOf(debug, actions);
    return { actions, debug };
  }

  private laneFrom(x: number): Lane {
    const center = this.calibration?.x ?? 0.5;
    const width = this.calibration?.shoulderWidth ?? 0.2;
    const leave = clamp(0.022, 0.07, width * 0.28);
    const back = leave * 0.45;
    if (this.lane === 0) {
      if (x < center - leave) return -1;
      if (x > center + leave) return 1;
      return 0;
    }
    if (this.lane === -1) return x > center - back ? 0 : -1;
    return x < center + back ? 0 : 1;
  }

  private debugFrom(frame: PoseFrame): GestureDebug {
    return {
      hipX: bodyX(frame),
      hipY: bodyY(frame),
      hipVel: 0,
      kneeAngle: kneeAngle(frame),
      lane: this.lane,
      sliding: this.sliding,
      canJump: this.canJump,
      visible: frame.visible,
      intent: "idle",
      offsetX: 0,
    };
  }
}

function bodyX(frame: PoseFrame): number {
  if (!frame.hasLowerBody) return frame.torso.x;
  return frame.torso.x * 0.7 + frame.hip.x * 0.3;
}

function bodyY(frame: PoseFrame): number {
  if (!frame.hasLowerBody) return frame.torso.y;
  return frame.torso.y * 0.7 + frame.hip.y * 0.3;
}

export function kneeAngle(frame: PoseFrame): number {
  return (
    (angleAt(frame.leftHip, frame.leftKnee, frame.leftAnkle) +
      angleAt(frame.rightHip, frame.rightKnee, frame.rightAnkle)) /
    2
  );
}

function intentOf(debug: GestureDebug, actions: GameAction[]): GameAction | "idle" {
  if (actions.includes("jump")) return "jump";
  if (actions.includes("slide") || debug.sliding) return "slide";
  if (debug.lane < 0) return "left";
  if (debug.lane > 0) return "right";
  if (debug.offsetX < -0.015) return "left";
  if (debug.offsetX > 0.015) return "right";
  return "idle";
}

function angleAt(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag === 0) return Math.PI;
  const cos = Math.min(1, Math.max(-1, (abx * cbx + aby * cby) / mag));
  return Math.acos(cos);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}
