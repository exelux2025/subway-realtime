import { createGame, type HudPayload, type MainScene } from "./game/MainScene";
import { inputBus } from "./input/InputBus";
import { GestureEngine } from "./pose/GestureEngine";
import { PoseTracker, type PoseFrame } from "./pose/PoseTracker";
import { SessionController } from "./session/SessionController";
import { Hud } from "./ui/Hud";

const video = requiredElement("webcam", HTMLVideoElement);
const skeleton = requiredElement("skeleton", HTMLCanvasElement);

inputBus.bindKeyboard();

const hud = new Hud();
const engine = new GestureEngine();
const tracker = new PoseTracker();
const game = createGame("game-root");

let autoCalibrating = true;
let frames = 0;
let fpsStamp = performance.now();
let lastPoseDebug: ReturnType<GestureEngine["update"]>["debug"] | null = null;

function scene(): MainScene | null {
  const main = game.scene.getScene("MainScene") as MainScene | undefined;
  if (!main?.sys.isActive()) return null;
  return main;
}

function fitCanvas(): void {
  const rect = video.getBoundingClientRect();
  skeleton.width = Math.max(1, Math.round(rect.width * devicePixelRatio));
  skeleton.height = Math.max(1, Math.round(rect.height * devicePixelRatio));
}

function clearPreview(): void {
  const ctx = skeleton.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, skeleton.width, skeleton.height);
  hud.setIntent("idle");
  hud.setPose(null, false);
}

function prepareCalibration(): void {
  autoCalibrating = true;
  engine.reset();
  engine.beginCalibration();
  lastPoseDebug = null;
}

const session = new SessionController({
  hud,
  tracker,
  engine,
  video,
  scene,
  fitCanvas,
  onStopPreview: clearPreview,
  onPrepareCalibration: prepareCalibration,
});

game.events.on("hud", (payload: HudPayload) => {
  hud.setGame(payload);
  if (payload.crashed) session.onCrash();
});

inputBus.on((action) => {
  hud.setGesture(action === "stand" ? "stand" : action);
});

hud.calibrate.addEventListener("click", () => {
  autoCalibrating = false;
  engine.reset();
  engine.beginCalibration();
  hud.setCamera("Hold still in the center…");
});

session.bind();

function advanceCalibration(frame: PoseFrame): void {
  if (engine.calibrated) return;
  engine.addCalibrationSample(frame);
  const needed = 12;
  hud.setCamera(
    autoCalibrating
      ? `Auto-calibrating ${engine.sampleCount()}/${needed} — stand still`
      : `Sampling stance ${engine.sampleCount()}/${needed}`,
  );
  if (engine.sampleCount() < needed) return;
  if (engine.finishCalibration()) {
    autoCalibrating = false;
    hud.setCamera("Tracking you. Lean, hop, or squat.");
    return;
  }
  engine.beginCalibration();
  if (!autoCalibrating) {
    hud.setCamera("Calibration failed — stand in frame and try again.");
  }
}

function loop(now: number): void {
  requestAnimationFrame(loop);
  frames += 1;
  if (now - fpsStamp >= 1000) {
    hud.setFps((frames * 1000) / (now - fpsStamp));
    frames = 0;
    fpsStamp = now;
  }

  if (session.state !== "running") return;

  const frame = tracker.detect(now);
  tracker.drawSkeleton(skeleton, frame);
  if (!frame) {
    hud.setPose(lastPoseDebug, engine.calibrated);
    hud.setIntent(engine.calibrated ? "lost" : "waiting");
    return;
  }

  advanceCalibration(frame);

  const { actions, debug } = engine.update(frame);
  lastPoseDebug = debug;
  hud.setPose(debug, engine.calibrated);
  hud.setIntent(debug.intent === "idle" ? (engine.calibrated ? "ready" : "idle") : debug.intent);
  if (engine.calibrated) {
    scene()?.applyPose(debug.lane, actions);
    if (debug.intent !== "idle") hud.setGesture(debug.intent);
  }
}

function requiredElement<T extends HTMLElement>(
  id: string,
  ctor: { new (): T },
): T {
  const node = document.getElementById(id);
  if (!(node instanceof ctor)) throw new Error(`Missing #${id}`);
  return node;
}

window.addEventListener("resize", fitCanvas);
requestAnimationFrame(loop);
