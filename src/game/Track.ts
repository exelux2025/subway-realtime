import Phaser from "phaser";
import { CENTER_X, GAME_H, GAME_W, PLAYER_Y, roadHalfWidth, VANISH_Y } from "./lanes";

export class Track {
  private scroll = 0;
  private readonly gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(0);
  }

  update(speed: number, deltaSec: number): void {
    this.scroll = (this.scroll + speed * deltaSec) % 90;
    this.draw();
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    g.fillStyle(0x0b0d12, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);

    const top = VANISH_Y;
    const topHalf = roadHalfWidth(top);
    const botHalf = roadHalfWidth(GAME_H);
    g.fillStyle(0x2a3140, 1);
    g.beginPath();
    g.moveTo(CENTER_X - topHalf, top);
    g.lineTo(CENTER_X + topHalf, top);
    g.lineTo(CENTER_X + botHalf, GAME_H);
    g.lineTo(CENTER_X - botHalf, GAME_H);
    g.closePath();
    g.fillPath();

    g.lineStyle(2, 0xc9a227, 0.85);
    for (const lane of [-0.5, 0.5]) {
      const spreadTop = roadHalfWidth(top) * (lane / 1.55);
      const spreadBot = roadHalfWidth(GAME_H) * (lane / 1.55);
      g.beginPath();
      g.moveTo(CENTER_X + spreadTop, top);
      g.lineTo(CENTER_X + spreadBot, GAME_H);
      g.strokePath();
    }

    g.lineStyle(3, 0x1a2030, 1);
    for (let i = 0; i < 14; i++) {
      const y = GAME_H - ((i * 90 + this.scroll) % (GAME_H - top)) - 8;
      if (y < top) continue;
      const half = roadHalfWidth(y);
      g.beginPath();
      g.moveTo(CENTER_X - half, y);
      g.lineTo(CENTER_X + half, y);
      g.strokePath();
    }

    g.fillStyle(0x3a4254, 1);
    g.fillRect(0, PLAYER_Y + 8, GAME_W, 6);
  }
}
