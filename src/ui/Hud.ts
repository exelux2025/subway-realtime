import type { HudPayload } from "../game/MainScene";
import type { GestureDebug } from "../pose/GestureEngine";

export type ControlState = {
  start: boolean;
  pause: boolean;
  end: boolean;
  calibrate: boolean;
};

export class Hud {
  private readonly score = el("stat-score");
  private readonly gesture = el("stat-gesture");
  private readonly lane = el("stat-lane");
  private readonly pose = el("stat-pose");
  private readonly debug = el("debug");
  private readonly camera = el("camera-status");
  private readonly intent = el("intent");
  readonly calibrate = el("btn-calibrate") as HTMLButtonElement;
  readonly start = el("btn-start") as HTMLButtonElement;
  readonly pause = el("btn-pause") as HTMLButtonElement;
  readonly end = el("btn-end") as HTMLButtonElement;
  private lastGesture = "—";
  private fps = 0;

  setCamera(text: string): void {
    this.camera.textContent = text;
  }

  setIntent(text: string): void {
    this.intent.textContent = text === "idle" || text === "ready" ? "" : text.toUpperCase();
    this.intent.dataset.state = text;
  }

  setGesture(action: string): void {
    this.lastGesture = action;
    this.gesture.textContent = action;
  }

  setFps(fps: number): void {
    this.fps = fps;
  }

  setPose(debug: GestureDebug | null, calibrated: boolean): void {
    if (!debug) {
      this.pose.textContent = calibrated ? "lost" : "waiting";
      return;
    }
    this.pose.textContent = debug.visible ? (calibrated ? "locked" : "visible") : "low";
    this.debug.textContent = [
      `fps ${this.fps.toFixed(0)}  ${calibrated ? "calibrated" : "not calibrated"}`,
      `x ${debug.hipX.toFixed(2)}  y ${debug.hipY.toFixed(2)}  dx ${debug.offsetX.toFixed(3)}`,
      `up-vel ${debug.hipVel.toFixed(2)}  intent ${debug.intent}`,
      `lane ${debug.lane}  jump ${debug.canJump ? "ready" : "wait"}  slide ${debug.sliding ? "yes" : "no"}`,
    ].join("\n");
  }

  setGame(payload: HudPayload): void {
    this.score.textContent = String(payload.score);
    this.lane.textContent = payload.lane;
    if (payload.crashed) this.gesture.textContent = "crash";
    else if (payload.paused) this.gesture.textContent = "paused";
    else if (this.gesture.textContent === "crash" || this.gesture.textContent === "paused") {
      this.gesture.textContent = this.lastGesture;
    }
  }

  setControls(state: ControlState): void {
    this.start.disabled = !state.start;
    this.pause.disabled = !state.pause;
    this.end.disabled = !state.end;
    this.calibrate.disabled = !state.calibrate;
  }
}

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}
