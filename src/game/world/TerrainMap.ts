import Phaser from "phaser";
import { COLORS, TERRAIN, WORLD, WORLD_HEIGHT, WORLD_WIDTH, type TerrainType } from "../../utils/constants";

/** Zona de terreno elíptica. Zonas posteriores na lista têm prioridade quando se sobrepõem. */
export interface TerrainZone {
  type: Exclude<TerrainType, "GRASS">;
  x: number;
  y: number;
  rx: number;
  ry: number;
}

const ZONE_COLORS: Record<TerrainZone["type"], { base: number; detail: number }> = {
  HILL: { base: 0x6f8f3a, detail: 0x86a64a },
  MUD: { base: 0x6b4f2e, detail: 0x57401f },
  SWAMP: { base: 0x3f5240, detail: 0x2b4a4a },
  FOREST: { base: 0x22501c, detail: 0x173d12 },
};

/** Grade do índice espacial: cada célula guarda as zonas que a tocam. */
const BUCKET = 800;

/**
 * Terreno do mundo: consulta de tipo por ponto. O continente tem centenas de zonas, então
 * a consulta usa um índice em grade (só as zonas da célula do ponto são testadas).
 */
export class TerrainMap {
  private readonly cols: number;
  private readonly rows: number;
  /** Índices das zonas por célula, em ordem crescente (a última que contém o ponto vence). */
  private readonly buckets: number[][];

  constructor(
    readonly zones: readonly TerrainZone[],
    width = WORLD_WIDTH,
    height = WORLD_HEIGHT,
  ) {
    this.cols = Math.ceil(width / BUCKET);
    this.rows = Math.ceil(height / BUCKET);
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
    zones.forEach((z, i) => {
      const c0 = Math.max(0, Math.floor((z.x - z.rx) / BUCKET));
      const c1 = Math.min(this.cols - 1, Math.floor((z.x + z.rx) / BUCKET));
      const r0 = Math.max(0, Math.floor((z.y - z.ry) / BUCKET));
      const r1 = Math.min(this.rows - 1, Math.floor((z.y + z.ry) / BUCKET));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.buckets[r * this.cols + c].push(i);
    });
  }

  typeAt(x: number, y: number): TerrainType {
    const col = Math.floor(x / BUCKET);
    const row = Math.floor(y / BUCKET);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return "GRASS";
    const list = this.buckets[row * this.cols + col];
    for (let i = list.length - 1; i >= 0; i--) {
      const z = this.zones[list[i]];
      const dx = (x - z.x) / z.rx;
      const dy = (y - z.y) / z.ry;
      if (dx * dx + dy * dy <= 1) return z.type;
    }
    return "GRASS";
  }
}

interface Chunk {
  objects: Phaser.GameObjects.GameObject[];
  bounds: Phaser.Geom.Rectangle;
  visible: boolean;
}

/**
 * Chão e terreno em pedaços (Marco 10): cada pedaço do mundo (CHUNK_SIZE) é desenhado
 * quando chega perto da câmera e destruído quando fica longe. O desenho de cada zona usa
 * uma semente própria, então o mesmo pedaço sai sempre igual, em qualquer ordem.
 * Uma zona é desenhada pelo pedaço do seu centro (a margem de um pedaço em volta da câmera
 * garante que zonas que avançam sobre a tela já estejam carregadas).
 */
export class TerrainStreamer {
  private readonly size = WORLD.CHUNK_SIZE;
  private readonly cols = Math.ceil(WORLD_WIDTH / WORLD.CHUNK_SIZE);
  private readonly rows = Math.ceil(WORLD_HEIGHT / WORLD.CHUNK_SIZE);
  /** Zonas por pedaço (pelo centro), com o índice original para a semente. */
  private readonly zonesByChunk = new Map<number, number[]>();
  private readonly loaded = new Map<number, Chunk>();
  private readonly view = new Phaser.Geom.Rectangle();
  private lastKey = "";

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly terrain: TerrainMap,
  ) {
    terrain.zones.forEach((z, i) => {
      const key = this.chunkIndex(z.x, z.y);
      const list = this.zonesByChunk.get(key) ?? [];
      list.push(i);
      this.zonesByChunk.set(key, list);
    });
  }

  /** Quantos pedaços estão desenhados agora (para testes de desempenho). */
  get loadedCount(): number {
    return this.loaded.size;
  }

  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    const w = camera.worldView;
    const s = this.size;
    // Carrega com 1 pedaço de margem; descarrega só além de 2 (evita pisca-pisca na borda)
    const c0 = Math.max(0, Math.floor(w.x / s) - 1);
    const c1 = Math.min(this.cols - 1, Math.floor(w.right / s) + 1);
    const r0 = Math.max(0, Math.floor(w.y / s) - 1);
    const r1 = Math.min(this.rows - 1, Math.floor(w.bottom / s) + 1);
    const key = `${c0},${c1},${r0},${r1}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (!this.loaded.has(r * this.cols + c)) this.load(c, r);
      for (const [index, chunk] of this.loaded) {
        const c = index % this.cols;
        const r = Math.floor(index / this.cols);
        if (c < c0 - 1 || c > c1 + 1 || r < r0 - 1 || r > r1 + 1) {
          for (const o of chunk.objects) o.destroy();
          this.loaded.delete(index);
        }
      }
    }
    // Entre os carregados, só os perto da tela são desenhados (o Phaser redesenha todo Graphics visível)
    const m = 400;
    this.view.setTo(w.x - m, w.y - m, w.width + m * 2, w.height + m * 2);
    for (const chunk of this.loaded.values()) {
      const visible = Phaser.Geom.Rectangle.Overlaps(this.view, chunk.bounds);
      if (visible === chunk.visible) continue;
      chunk.visible = visible;
      for (const o of chunk.objects) (o as Phaser.GameObjects.Graphics).setVisible(visible);
    }
  }

  destroy(): void {
    for (const chunk of this.loaded.values()) for (const o of chunk.objects) o.destroy();
    this.loaded.clear();
  }

  private chunkIndex(x: number, y: number): number {
    const c = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.size)));
    const r = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.size)));
    return r * this.cols + c;
  }

  private load(c: number, r: number): void {
    const s = this.size;
    const x0 = c * s;
    const y0 = r * s;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const bounds = new Phaser.Geom.Rectangle(x0, y0, s, s);

    // Grama com grade
    const ground = this.scene.add.graphics().setDepth(-10);
    ground.fillStyle(COLORS.GRASS, 1);
    ground.fillRect(x0, y0, s, s);
    ground.lineStyle(1, COLORS.GRID, 0.6);
    for (let x = x0; x <= x0 + s; x += 100) ground.lineBetween(x, y0, x, y0 + s);
    for (let y = y0; y <= y0 + s; y += 100) ground.lineBetween(x0, y, x0 + s, y);
    objects.push(ground);

    const zones = this.zonesByChunk.get(r * this.cols + c) ?? [];
    for (const i of zones) {
      const z = this.terrain.zones[i];
      // Uma camada por zona, na ordem da lista: onde zonas se sobrepõem, o desenho bate com typeAt
      const g = this.scene.add.graphics().setDepth(-9 + i / 100000);
      drawZone(g, z, new Phaser.Math.RandomDataGenerator([`zona-${i}`]));
      const label = this.scene.add
        .text(z.x, z.y - z.ry + 14, TERRAIN[z.type].label.toUpperCase(), {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setAlpha(0.35)
        .setDepth(-8);
      objects.push(g, label);
      Phaser.Geom.Rectangle.Union(bounds, new Phaser.Geom.Rectangle(z.x - z.rx, z.y - z.ry - 20, z.rx * 2, z.ry * 2 + 20), bounds);
    }
    this.loaded.set(r * this.cols + c, { objects, bounds, visible: true });
  }
}

function randomPointIn(z: TerrainZone, rnd: Phaser.Math.RandomDataGenerator, scale: number) {
  const a = rnd.angle() * (Math.PI / 180);
  const r = Math.sqrt(rnd.frac()) * scale;
  return { x: z.x + Math.cos(a) * z.rx * r, y: z.y + Math.sin(a) * z.ry * r };
}

/** Desenho greybox de uma zona: elipse e detalhes do tipo (curvas de nível, poças, árvores). */
function drawZone(g: Phaser.GameObjects.Graphics, z: TerrainZone, rnd: Phaser.Math.RandomDataGenerator): void {
  const c = ZONE_COLORS[z.type];
  g.fillStyle(c.base, 1);
  g.fillEllipse(z.x, z.y, z.rx * 2, z.ry * 2, 96);

  switch (z.type) {
    case "HILL":
      // Curvas de nível
      for (const k of [0.75, 0.5, 0.25]) {
        g.lineStyle(2, c.detail, 0.9);
        g.strokeEllipse(z.x, z.y, z.rx * 2 * k, z.ry * 2 * k, 96);
      }
      break;
    case "MUD":
      for (let i = 0; i < 14; i++) {
        const p = randomPointIn(z, rnd, 0.85);
        g.fillStyle(c.detail, 1);
        g.fillEllipse(p.x, p.y, rnd.between(20, 50), rnd.between(10, 24));
      }
      break;
    case "SWAMP":
      for (let i = 0; i < 10; i++) {
        const p = randomPointIn(z, rnd, 0.8);
        g.fillStyle(c.detail, 1);
        g.fillEllipse(p.x, p.y, rnd.between(40, 90), rnd.between(20, 40));
      }
      break;
    case "FOREST": {
      const trees = Math.round((z.rx * z.ry) / 1400);
      for (let i = 0; i < trees; i++) {
        const p = randomPointIn(z, rnd, 0.92);
        g.fillStyle(c.detail, 1);
        g.fillCircle(p.x, p.y, rnd.between(8, 15));
      }
      break;
    }
  }
}
