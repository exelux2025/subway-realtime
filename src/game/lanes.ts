import type { Lane } from "../types";

export type { Lane };

export const GAME_W = 420;
export const GAME_H = 720;
export const PLAYER_Y = 560;
export const VANISH_Y = 96;
export const CENTER_X = GAME_W / 2;

export function depthT(y: number): number {
  return Math.min(1, Math.max(0, (y - VANISH_Y) / (GAME_H - VANISH_Y)));
}

export function laneSpread(y: number): number {
  return 36 + depthT(y) * 88;
}

export function laneX(lane: Lane | number, y: number): number {
  return CENTER_X + lane * laneSpread(y);
}

export function depthScale(y: number): number {
  return 0.28 + depthT(y) * 0.72;
}

export function roadHalfWidth(y: number): number {
  return laneSpread(y) * 1.55;
}

export function laneName(lane: number): string {
  if (lane < 0) return "left";
  if (lane > 0) return "right";
  return "center";
}

export function clampLane(lane: number): Lane {
  if (lane < -1) return -1;
  if (lane > 1) return 1;
  return lane as Lane;
}
