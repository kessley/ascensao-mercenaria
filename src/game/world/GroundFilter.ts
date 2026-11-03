import { pixelGround, waterSpots, type WaterSpot } from "../art/ground";
import type { GroundDone, GroundJob } from "../art/groundWorker";

export interface FilterRequest {
  data: Uint8ClampedArray;
  w: number;
  h: number;
  x0: number;
  y0: number;
  flowers: number;
  inner: GroundJob["inner"];
}

type Done = (data: Uint8ClampedArray, spots: WaterSpot[]) => void;

/**
 * Manda o filtro do chão para um worker e devolve o resultado quando ele acaba. Sem worker (ou se
 * ele quebrar), filtra na hora, na linha principal, como antes.
 */
export class GroundFilter {
  private worker: Worker | null = null;
  private serial = 1;
  private readonly waiting = new Map<number, { done: Done; fail: () => void }>();

  constructor() {
    try {
      this.worker = new Worker(new URL("../art/groundWorker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (e: MessageEvent<GroundDone>) => {
        const job = this.waiting.get(e.data.id);
        if (!job) return;
        this.waiting.delete(e.data.id);
        job.done(new Uint8ClampedArray(e.data.buffer), e.data.spots);
      };
      this.worker.onerror = () => this.breakDown();
    } catch {
      this.worker = null;
    }
  }

  /** Quantos pedaços estão no worker agora. */
  get pending(): number {
    return this.waiting.size;
  }

  /** Filtra a imagem; `fail` avisa que o pedaço se perdeu (o worker quebrou) e deve ser pedido de novo. */
  run(req: FilterRequest, done: Done, fail: () => void): void {
    if (!this.worker) {
      pixelGround(req.data, req.w, req.h, req.x0, req.y0, req.flowers);
      done(req.data, req.inner ? waterSpots(req.w, req.h, req.x0, req.y0, req.inner) : []);
      return;
    }
    const id = this.serial++;
    this.waiting.set(id, { done, fail });
    const buffer = req.data.buffer as ArrayBuffer;
    const job: GroundJob = { id, buffer, w: req.w, h: req.h, x0: req.x0, y0: req.y0, flowers: req.flowers, inner: req.inner };
    this.worker.postMessage(job, [buffer]);
  }

  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.waiting.clear();
  }

  private breakDown(): void {
    this.worker?.terminate();
    this.worker = null;
    const lost = [...this.waiting.values()];
    this.waiting.clear();
    for (const job of lost) job.fail();
  }
}
