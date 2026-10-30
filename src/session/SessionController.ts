import type { MainScene } from "../game/MainScene";
import type { GestureEngine } from "../pose/GestureEngine";
import type { PoseTracker } from "../pose/PoseTracker";
import type { Session } from "../types";
import type { Hud } from "../ui/Hud";

type SessionDeps = {
  hud: Hud;
  tracker: PoseTracker;
  engine: GestureEngine;
  video: HTMLVideoElement;
  scene: () => MainScene | null;
  fitCanvas: () => void;
  onStopPreview: () => void;
  onPrepareCalibration: () => void;
};

export class SessionController {
  private session: Session = "idle";
  private starting = false;

  constructor(private readonly deps: SessionDeps) {}

  get state(): Session {
    return this.session;
  }

  bind(): void {
    const { hud } = this.deps;
    hud.start.addEventListener("click", () => {
      void this.start();
    });
    hud.pause.addEventListener("click", () => this.pause());
    hud.end.addEventListener("click", () => this.end());
    this.syncControls();
  }

  onCrash(): void {
    if (this.session !== "running") return;
    this.deps.hud.setControls({ start: true, pause: false, end: true, calibrate: true });
  }

  async start(): Promise<void> {
    if (this.starting) return;
    if (this.session === "running") {
      this.deps.scene()?.startRun();
      return;
    }

    this.starting = true;
    this.deps.hud.setControls({
      start: false,
      pause: false,
      end: this.session !== "idle",
      calibrate: false,
    });
    this.deps.hud.setCamera("Requesting camera…");

    try {
      await this.deps.tracker.start(this.deps.video);
      this.deps.fitCanvas();
      if (this.session === "paused") {
        this.deps.scene()?.resumeRun();
        this.deps.hud.setCamera(
          this.deps.engine.calibrated
            ? "Tracking you. Lean, hop, or squat."
            : "Hold still to auto-calibrate",
        );
      } else {
        this.deps.onPrepareCalibration();
        this.deps.scene()?.startRun();
        this.deps.hud.setCamera("Camera on — hold still to auto-calibrate");
      }
      this.setSession("running");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Camera unavailable";
      this.deps.hud.setCamera(`${message} Keyboard still works.`);
      if (this.session === "paused") this.deps.scene()?.resumeRun();
      else this.deps.scene()?.startRun();
      this.setSession("running");
    } finally {
      this.starting = false;
    }
  }

  pause(): void {
    if (this.session !== "running") return;
    this.deps.scene()?.pauseRun();
    this.deps.tracker.stopCamera();
    this.deps.onStopPreview();
    this.deps.hud.setCamera("Paused — camera off");
    this.setSession("paused");
  }

  end(): void {
    if (this.session === "idle") return;
    this.deps.scene()?.endRun();
    this.deps.tracker.stopCamera();
    this.deps.engine.reset();
    this.deps.onPrepareCalibration();
    this.deps.onStopPreview();
    this.deps.hud.setCamera("Ended — camera off");
    this.deps.hud.setGesture("—");
    this.setSession("idle");
  }

  private setSession(next: Session): void {
    this.session = next;
    this.syncControls();
  }

  private syncControls(): void {
    this.deps.hud.setControls({
      start: this.session !== "running" && !this.starting,
      pause: this.session === "running",
      end: this.session === "running" || this.session === "paused",
      calibrate: this.session === "running",
    });
  }
}
