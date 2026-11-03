import { pixelGround, waterSpots, type WaterSpot } from "./ground";

/**
 * O filtro do chão em pixel art fora da linha principal (G2): é a parte cara de cada pedaço (uns
 * 13 ms) e não depende de nada do jogo, só dos pixels. A imagem vem e volta transferida, sem cópia.
 */

export interface GroundJob {
  id: number;
  buffer: ArrayBuffer;
  w: number;
  h: number;
  x0: number;
  y0: number;
  flowers: number;
  /** De perto: onde procurar os brilhos da água (o pedaço sem a folga). */
  inner: { x: number; y: number; w: number; h: number } | null;
}

export interface GroundDone {
  id: number;
  buffer: ArrayBuffer;
  spots: WaterSpot[];
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<GroundJob>) => void) | null;
  postMessage(message: GroundDone, transfer: Transferable[]): void;
};

scope.onmessage = (e) => {
  const job = e.data;
  const data = new Uint8ClampedArray(job.buffer);
  pixelGround(data, job.w, job.h, job.x0, job.y0, job.flowers);
  const spots = job.inner ? waterSpots(job.w, job.h, job.x0, job.y0, job.inner) : [];
  scope.postMessage({ id: job.id, buffer: job.buffer, spots }, [job.buffer]);
};
