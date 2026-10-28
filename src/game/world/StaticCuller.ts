import Phaser from "phaser";

/** Desenha além da borda da câmera (evita "pipocar" ao rolar a tela). */
const MARGIN = 400;

type Cullable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;

/**
 * Culling dos desenhos estáticos do mundo grande (estradas, povoados, locais): o Phaser
 * reexecuta todos os comandos de um Graphics a cada quadro, então só o que está perto da
 * câmera fica visível. O chão e o terreno são carregados em pedaços (TerrainStreamer).
 */
export class StaticCuller {
  private items: { obj: Cullable; bounds: Phaser.Geom.Rectangle }[] = [];
  private readonly view = new Phaser.Geom.Rectangle();

  add(obj: Cullable, bounds: Phaser.Geom.Rectangle): void {
    this.items.push({ obj, bounds });
  }

  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    const w = camera.worldView;
    this.view.setTo(w.x - MARGIN, w.y - MARGIN, w.width + MARGIN * 2, w.height + MARGIN * 2);
    // Objetos destruídos (bandeira trocada, covil vencido) saem da lista
    if (this.items.some(({ obj }) => !obj.scene)) this.items = this.items.filter(({ obj }) => !!obj.scene);
    for (const { obj, bounds } of this.items) obj.setVisible(Phaser.Geom.Rectangle.Overlaps(this.view, bounds));
  }
}
