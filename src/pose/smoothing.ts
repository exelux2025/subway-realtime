export class EmaPoint {
  x = 0;
  y = 0;
  private initialized = false;

  constructor(private readonly alpha: number) {}

  next(x: number, y: number): { x: number; y: number } {
    if (!this.initialized) {
      this.x = x;
      this.y = y;
      this.initialized = true;
      return this;
    }
    this.x = this.alpha * x + (1 - this.alpha) * this.x;
    this.y = this.alpha * y + (1 - this.alpha) * this.y;
    return this;
  }

  reset(): void {
    this.initialized = false;
  }
}
