import Phaser from "phaser";
import { depthScale, GAME_H, laneX, VANISH_Y, type Lane } from "./lanes";

export type ObstacleKind = "block" | "jump" | "slide";

export type Obstacle = {
  lane: Lane;
  kind: ObstacleKind;
  sprite: Phaser.GameObjects.Rectangle;
  resolved: boolean;
};

type Pattern = { lane: Lane; kind: ObstacleKind }[];

const TUTORIAL: Pattern[] = [
  [{ lane: -1, kind: "block" }],
  [{ lane: 1, kind: "block" }],
  [
    { lane: 0, kind: "jump" },
    { lane: -1, kind: "block" },
  ],
  [
    { lane: 0, kind: "slide" },
    { lane: 1, kind: "block" },
  ],
  [
    { lane: -1, kind: "jump" },
    { lane: 0, kind: "jump" },
    { lane: 1, kind: "jump" },
  ],
  [
    { lane: -1, kind: "slide" },
    { lane: 0, kind: "slide" },
    { lane: 1, kind: "slide" },
  ],
];

export class Spawner {
  readonly obstacles: Obstacle[] = [];
  private elapsed = 0;
  private spawnIndex = 0;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(speed: number, deltaSec: number, playing: boolean): void {
    if (playing) {
      this.elapsed += deltaSec;
      const interval = Math.max(0.72, 1.55 - this.spawnIndex * 0.04);
      if (this.elapsed >= interval) {
        this.elapsed = 0;
        this.spawn(this.nextPattern());
        this.spawnIndex += 1;
      }
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const item = this.obstacles[i];
      item.sprite.y += speed * deltaSec;
      const scale = depthScale(item.sprite.y);
      item.sprite.x = laneX(item.lane, item.sprite.y);
      item.sprite.setScale(scale);
      applyShape(item.sprite, item.kind);
      if (item.sprite.y > GAME_H + 80) {
        item.sprite.destroy();
        this.obstacles.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const item of this.obstacles) item.sprite.destroy();
    this.obstacles.length = 0;
    this.elapsed = 0;
    this.spawnIndex = 0;
  }

  private nextPattern(): Pattern {
    if (this.spawnIndex < TUTORIAL.length) return TUTORIAL[this.spawnIndex];
    return randomPattern();
  }

  private spawn(pattern: Pattern): void {
    for (const item of pattern) {
      const y = VANISH_Y - 20;
      const sprite = this.scene.add.rectangle(laneX(item.lane, y), y, 8, 8, colorFor(item.kind));
      sprite.setOrigin(0.5, 1);
      sprite.setDepth(10);
      sprite.setScale(depthScale(y));
      applyShape(sprite, item.kind);
      this.obstacles.push({ lane: item.lane, kind: item.kind, sprite, resolved: false });
    }
  }
}

function colorFor(kind: ObstacleKind): number {
  if (kind === "block") return 0xc45c26;
  if (kind === "jump") return 0xe6b800;
  return 0x7b5cff;
}

function applyShape(sprite: Phaser.GameObjects.Rectangle, kind: ObstacleKind): void {
  if (kind === "block") sprite.setSize(56, 118);
  else if (kind === "jump") sprite.setSize(54, 24);
  else sprite.setSize(54, 92);
}

function randomPattern(): Pattern {
  const lanes: Lane[] = [-1, 0, 1];
  const pickLane = (): Lane => lanes[Math.floor(Math.random() * 3)];
  const r = Math.random();
  if (r < 0.25) return [{ lane: pickLane(), kind: "block" }];
  if (r < 0.45) {
    const open = pickLane();
    return lanes.filter((lane) => lane !== open).map((lane) => ({ lane, kind: "block" }));
  }
  if (r < 0.6) return lanes.map((lane) => ({ lane, kind: "jump" }));
  if (r < 0.75) return lanes.map((lane) => ({ lane, kind: "slide" }));
  const a = pickLane();
  const b = lanes.find((lane) => lane !== a) ?? 0;
  const kind: ObstacleKind = Math.random() < 0.5 ? "jump" : "slide";
  return [
    { lane: a, kind: "block" },
    { lane: b, kind },
  ];
}
