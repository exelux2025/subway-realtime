import type { GameAction } from "../types";

export type { GameAction };

type Listener = (action: GameAction) => void;

export class InputBus {
  private listeners = new Set<Listener>();
  private held = new Set<string>();

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(action: GameAction): void {
    for (const listener of this.listeners) listener(action);
  }

  bindKeyboard(): void {
    window.addEventListener("keydown", (event) => {
      const key = event.key;
      if (this.isGameKey(key)) event.preventDefault();
      if (event.repeat || this.held.has(key)) return;
      this.held.add(key);

      if (key === "ArrowLeft" || key === "a" || key === "A") this.emit("left");
      else if (key === "ArrowRight" || key === "d" || key === "D") this.emit("right");
      else if (key === "ArrowUp" || key === "w" || key === "W" || key === " ") this.emit("jump");
      else if (key === "ArrowDown" || key === "s" || key === "S") this.emit("slide");
    });

    window.addEventListener("keyup", (event) => {
      const key = event.key;
      this.held.delete(key);
      if (key === "ArrowDown" || key === "s" || key === "S") this.emit("stand");
    });
  }

  private isGameKey(key: string): boolean {
    return (
      key === "ArrowLeft" ||
      key === "ArrowRight" ||
      key === "ArrowUp" ||
      key === "ArrowDown" ||
      key === " " ||
      key === "a" ||
      key === "A" ||
      key === "d" ||
      key === "D" ||
      key === "w" ||
      key === "W" ||
      key === "s" ||
      key === "S"
    );
  }
}

export const inputBus = new InputBus();
