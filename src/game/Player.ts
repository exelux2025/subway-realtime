import Phaser from "phaser";
import type { GameAction, Lane } from "../types";
import { clampLane, laneX, PLAYER_Y } from "./lanes";

const JUMP_MS = 420;
const JUMP_HEIGHT = 78;
const RUN_H = 58;
const SLIDE_H = 28;
const WIDTH = 34;

export class Player {
  readonly sprite: Phaser.GameObjects.Rectangle;
  lane: Lane = 0;
  jumping = false;
  sliding = false;
  private jumpT = 0;

  constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.rectangle(laneX(0, PLAYER_Y), PLAYER_Y, WIDTH, RUN_H, 0x4cc3ff);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setStrokeStyle(3, 0xecfbff);
    this.sprite.setDepth(20);
    this.head = scene.add.circle(this.sprite.x, PLAYER_Y - RUN_H, 11, 0xecfbff);
    this.head.setDepth(21);
  }

  readonly head: Phaser.GameObjects.Arc;

  handle(action: GameAction): void {
    if (action === "left") this.setLane(this.lane - 1);
    if (action === "right") this.setLane(this.lane + 1);
    if (action === "jump") this.jump();
    if (action === "slide") this.startSlide();
    if (action === "stand") this.endSlide();
  }

  setLane(lane: number): void {
    this.lane = clampLane(lane);
  }

  jump(): void {
    if (this.jumping || this.sliding) return;
    this.jumping = true;
    this.jumpT = 0;
  }

  startSlide(): void {
    if (this.jumping) return;
    this.sliding = true;
    this.sprite.setSize(WIDTH, SLIDE_H);
    this.sprite.setFillStyle(0x7bd4ff);
  }

  endSlide(): void {
    if (!this.sliding) return;
    this.sliding = false;
    this.sprite.setSize(WIDTH, RUN_H);
    this.sprite.setFillStyle(0x4cc3ff);
  }

  update(deltaMs: number): void {
    const x = laneX(this.lane, PLAYER_Y);
    this.sprite.x += (x - this.sprite.x) * Math.min(1, deltaMs / 80);

    if (this.jumping) {
      this.jumpT += deltaMs;
      const t = Math.min(1, this.jumpT / JUMP_MS);
      const lift = Math.sin(Math.PI * t) * JUMP_HEIGHT;
      this.sprite.y = PLAYER_Y - lift;
      this.sprite.setFillStyle(0x9be2ff);
      if (t >= 1) {
        this.jumping = false;
        this.sprite.y = PLAYER_Y;
        this.sprite.setFillStyle(this.sliding ? 0x7bd4ff : 0x4cc3ff);
      }
    } else {
      this.sprite.y = PLAYER_Y;
    }
    const bodyH = this.sliding ? SLIDE_H : RUN_H;
    this.head.setPosition(this.sprite.x, this.sprite.y - bodyH);
    this.head.setVisible(!this.sliding);
  }

  reset(): void {
    this.lane = 0;
    this.jumping = false;
    this.sliding = false;
    this.jumpT = 0;
    this.sprite.x = laneX(0, PLAYER_Y);
    this.sprite.y = PLAYER_Y;
    this.sprite.setSize(WIDTH, RUN_H);
    this.sprite.setFillStyle(0x4cc3ff);
    this.sprite.setStrokeStyle(3, 0xecfbff);
    this.sprite.setAlpha(1);
    this.head.setFillStyle(0xecfbff);
    this.head.setVisible(true);
    this.head.setPosition(this.sprite.x, PLAYER_Y - RUN_H);
  }
}
