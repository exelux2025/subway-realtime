import Phaser from "phaser";
import { inputBus } from "../input/InputBus";
import type { GameAction, Lane } from "../types";
import { GAME_H, GAME_W, laneName, PLAYER_Y } from "./lanes";
import { Player } from "./Player";
import { Spawner } from "./Spawner";
import { Track } from "./Track";

export type HudPayload = {
  score: number;
  playing: boolean;
  paused: boolean;
  crashed: boolean;
  lane: string;
};

export class MainScene extends Phaser.Scene {
  private player!: Player;
  private spawner!: Spawner;
  private track!: Track;
  private unbind: (() => void) | null = null;
  private banner!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private flash!: Phaser.GameObjects.Text;
  private playing = false;
  private paused = false;
  private crashed = false;
  private distance = 0;
  private speed = 260;

  constructor() {
    super("MainScene");
  }

  create(): void {
    this.track = new Track(this);
    this.player = new Player(this);
    this.spawner = new Spawner(this);

    this.scoreText = this.add
      .text(16, 16, "0", { fontFamily: "sans-serif", fontSize: "22px", color: "#e8edf5" })
      .setDepth(40);
    this.banner = this.add
      .text(GAME_W / 2, 220, "Press Start.\nLean to steer once the camera is on.", {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#e8edf5",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(40);

    this.flash = this.add
      .text(GAME_W / 2, PLAYER_Y - 130, "", {
        fontFamily: "sans-serif",
        fontSize: "28px",
        color: "#4cc3ff",
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.unbind = inputBus.on((action) => this.onAction(action));
    this.input.keyboard?.on("keydown-R", () => {
      if (this.crashed) this.startRun();
    });
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.unbind?.());
    this.pushHud();
  }

  startRun(): void {
    this.playing = true;
    this.paused = false;
    this.crashed = false;
    this.distance = 0;
    this.speed = 260;
    this.player.reset();
    this.spawner.clear();
    this.banner.setVisible(false);
    this.pushHud();
  }

  pauseRun(): void {
    if (!this.playing && !this.paused) return;
    this.paused = true;
    this.banner.setText("Paused");
    this.banner.setVisible(true);
    this.pushHud();
  }

  resumeRun(): void {
    if (this.crashed || !this.playing) {
      this.startRun();
      return;
    }
    this.paused = false;
    this.banner.setVisible(false);
    this.pushHud();
  }

  endRun(): void {
    this.playing = false;
    this.paused = false;
    this.crashed = false;
    this.distance = 0;
    this.speed = 260;
    this.player.reset();
    this.spawner.clear();
    this.scoreText.setText("0");
    this.banner.setText("Session ended.\nPress Start");
    this.banner.setVisible(true);
    this.pushHud();
  }

  applyPose(lane: Lane, actions: GameAction[]): void {
    if (this.crashed || this.paused) return;
    this.player.setLane(lane);
    for (const action of actions) {
      if (action === "left" || action === "right") continue;
      this.player.handle(action);
    }
    const notable = actions.find((action) => action !== "stand");
    if (notable) this.showFlash(notable);
    this.pushHud();
  }

  private onAction(action: GameAction): void {
    if (this.crashed || this.paused) return;
    this.player.handle(action);
    if (action !== "stand") this.showFlash(action);
    this.pushHud();
  }

  private showFlash(action: GameAction): void {
    this.flash.setText(action.toUpperCase());
    this.flash.setAlpha(1);
    this.tweens.killTweensOf(this.flash);
    this.tweens.add({
      targets: this.flash,
      alpha: 0,
      duration: 380,
      delay: 180,
    });
  }

  update(_time: number, delta: number): void {
    if (this.paused) return;
    const dt = delta / 1000;
    this.track.update(this.speed, dt);
    this.player.update(delta);
    this.spawner.update(this.speed, dt, this.playing && !this.crashed);
    this.checkHits();

    if (this.playing && !this.crashed) {
      this.distance += this.speed * dt * 0.12;
      this.speed = Math.min(640, 260 + this.distance * 0.18);
      this.scoreText.setText(String(Math.floor(this.distance)));
      this.pushHud();
    }
  }

  private checkHits(): void {
    if (!this.playing || this.crashed) return;
    for (const obstacle of this.spawner.obstacles) {
      if (obstacle.resolved) continue;
      const y = obstacle.sprite.y;
      if (y < PLAYER_Y - 18 || y > PLAYER_Y + 36) continue;
      obstacle.resolved = true;
      if (obstacle.lane !== this.player.lane) continue;
      if (obstacle.kind === "jump" && this.player.jumping) continue;
      if (obstacle.kind === "slide" && this.player.sliding) continue;
      this.crash();
      return;
    }
  }

  private crash(): void {
    this.crashed = true;
    this.playing = false;
    this.player.sprite.setFillStyle(0xe0584a);
    this.player.head.setFillStyle(0xe0584a);
    this.banner.setText("Crashed\nPress Start");
    this.banner.setVisible(true);
    this.pushHud();
  }

  private pushHud(): void {
    const payload: HudPayload = {
      score: Math.floor(this.distance),
      playing: this.playing,
      paused: this.paused,
      crashed: this.crashed,
      lane: laneName(this.player.lane),
    };
    this.game.events.emit("hud", payload);
  }
}

export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_W,
    height: GAME_H,
    backgroundColor: "#12151c",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [MainScene],
  });
}
