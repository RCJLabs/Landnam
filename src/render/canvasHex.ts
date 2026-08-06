// Shared hex board canvas: camera (pan/zoom), pointer input, hex hit-testing.
// Skins (chartRender, battleRender) supply the actual painting via draw().

import { Axial, fromPixel, toPixel, corners } from '../core/hex';

export interface BoardCallbacks {
  onHover?(hex: Axial | null): void;
  onClick?(hex: Axial): void;
  /** Called every frame with the 2d context already camera-transformed. */
  draw(ctx: CanvasRenderingContext2D, board: HexBoard): void;
}

export class HexBoard {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  hexSize: number;
  camX = 0;
  camY = 0;
  zoom = 1;
  minZoom = 0.5;
  maxZoom = 2.5;
  hovered: Axial | null = null;
  private cbs: BoardCallbacks;
  private dragging = false;
  private dragMoved = false;
  private lastPointer = { x: 0, y: 0 };
  private rafPending = false;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, hexSize: number, cbs: BoardCallbacks) {
    this.canvas = canvas;
    this.hexSize = hexSize;
    this.cbs = cbs;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('resize', this.requestDraw);
    this.resizeToDisplay();
  }

  dispose(): void {
    this.disposed = true;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.requestDraw);
  }

  resizeToDisplay(): void {
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = this.canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    const w = Math.round(clientWidth * dpr);
    const h = Math.round(clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  /** Center the camera on a hex. */
  centerOn(h: Axial): void {
    const p = toPixel(h, this.hexSize);
    this.camX = p.x;
    this.camY = p.y;
    this.requestDraw();
  }

  screenToHex(sx: number, sy: number): Axial {
    const rect = this.canvas.getBoundingClientRect();
    const x = (sx - rect.left - rect.width / 2) / this.zoom + this.camX;
    const y = (sy - rect.top - rect.height / 2) / this.zoom + this.camY;
    return fromPixel(x, y, this.hexSize);
  }

  /** Paint helper: trace the hex path at its world position. */
  tracePath(h: Axial, inset = 0): void {
    const { x, y } = toPixel(h, this.hexSize);
    const pts = corners(x, y, this.hexSize - inset);
    this.ctx.beginPath();
    this.ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < 6; i++) this.ctx.lineTo(pts[i]!.x, pts[i]!.y);
    this.ctx.closePath();
  }

  worldPos(h: Axial): { x: number; y: number } {
    return toPixel(h, this.hexSize);
  }

  requestDraw = (): void => {
    if (this.rafPending || this.disposed) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      if (this.disposed) return;
      this.drawFrame();
    });
  };

  private drawFrame(): void {
    this.resizeToDisplay();
    const { ctx, canvas } = this;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.translate(canvas.clientWidth / 2, canvas.clientHeight / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);
    this.cbs.draw(ctx, this);
    ctx.restore();
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.dragMoved = false;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.dragging) {
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.dragMoved = true;
      if (this.dragMoved) {
        this.camX -= dx / this.zoom;
        this.camY -= dy / this.zoom;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.requestDraw();
      }
      return;
    }
    const hex = this.screenToHex(e.clientX, e.clientY);
    if (!this.hovered || hex.q !== this.hovered.q || hex.r !== this.hovered.r) {
      this.hovered = hex;
      this.cbs.onHover?.(hex);
      this.requestDraw();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    const wasDrag = this.dragMoved;
    this.dragging = false;
    this.dragMoved = false;
    if (!wasDrag) {
      this.cbs.onClick?.(this.screenToHex(e.clientX, e.clientY));
    }
  };

  private onPointerLeave = (): void => {
    this.dragging = false;
    if (this.hovered) {
      this.hovered = null;
      this.cbs.onHover?.(null);
      this.requestDraw();
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    this.requestDraw();
  };
}
