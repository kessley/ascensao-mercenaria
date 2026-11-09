import { Grid, gridBitmap, ramp, type Bitmap } from "./pixel";
import type { Piece } from "./buildings";

/**
 * O lugar de trabalho de cada seguidor do acampamento (G4): o caldeirão do cozinheiro, a banca
 * do mascate, a enfermaria da curandeira, o púlpito do capelão, a bigorna do ajudante de
 * ferreiro e o varal das famílias. E a carga de ferro que vai nas costas de quem a leva.
 * Peças como as do G3: o ponto de apoio é o pé da peça, e quem está mais embaixo passa na frente.
 */

export type StationRole = "COOK" | "PEDDLER" | "HEALER" | "CHAPLAIN" | "FAMILY" | "SMITH";

const WOOD = ramp(0x7a5432);
const WOOD_DARK = 0x4e3420;
const IRON = ramp(0x4a4c50);
const BAR = ramp(0x8a949c);
const CANVAS = ramp(0xe8e0cc);
const STRAW = ramp(0xb8a060);
const CROSS = 0xc0392b;
const EMBER = 0xe67e22;
const FLAME = 0xf4c24a;
const WATER = 0x2b5a7b;

/** Uma peça com o pé em (ax, ay) dentro da grade, já com o contorno. */
function piece(w: number, h: number, ax: number, ay: number, draw: (g: Grid) => void): Piece {
  const g = new Grid(w, h);
  draw(g);
  g.outline();
  return { grid: g, dx: -ax, dy: -ay };
}

/** Trempe de três paus com o caldeirão, o fogo embaixo e a lenha ao lado. */
function cauldron(): Piece {
  return piece(52, 40, 22, 36, (g) => {
    // A lenha empilhada, à direita
    for (let k = 0; k < 3; k++) {
      g.rect(36, 28 + k * 3 - (k === 2 ? 3 : 0), 12, 3, k % 2 ? WOOD.dark : WOOD.base);
      g.px(36, 28 + k * 3 - (k === 2 ? 3 : 0), WOOD.light);
    }
    g.line(8, 34, 21, 4, WOOD_DARK);
    g.line(36, 34, 23, 4, WOOD_DARK);
    // O fogo e as brasas
    g.oval(22, 33, 6, 2, EMBER);
    g.rect(19, 30, 2, 3, FLAME);
    g.rect(23, 29, 2, 4, FLAME);
    // O caldeirão pendurado, com o ensopado
    g.line(22, 4, 22, 14, IRON.dark);
    g.oval(22, 22, 9, 7, IRON.base);
    g.rect(15, 26, 15, 2, IRON.dark);
    g.oval(22, 17, 8, 2, 0x8a6a3a);
    g.px(19, 17, 0xb08a50);
    g.px(25, 16, 0xb08a50);
    g.line(10, 35, 13, 30, WOOD_DARK);
  });
}

/** Banca com toldo listrado e as bugigangas em cima. */
function stall(): Piece {
  return piece(84, 44, 42, 40, (g) => {
    for (const x of [6, 76]) g.rect(x, 4, 2, 34, WOOD.dark);
    // O toldo listrado, em azul e cru
    for (let x = 2; x < 82; x++) g.rect(x, 3, 1, 11, Math.floor((x - 2) / 8) % 2 ? 0xf0e6d2 : 0x3a6ab8);
    g.rect(2, 13, 80, 1, 0x26487e);
    for (let x = 2; x < 82; x += 8) g.rect(x, 14, 4, 2, 0x3a6ab8);
    // O balcão e o que está à venda
    g.rect(4, 24, 76, 4, WOOD.light);
    g.rect(4, 28, 76, 10, WOOD.base);
    g.rect(4, 37, 76, 1, WOOD.dark);
    for (const [x, c] of [
      [10, 0xc9a23a],
      [24, 0xb84a3a],
      [40, 0x3a9a5a],
      [56, 0xd8d8d8],
      [68, 0x8a5a9a],
    ] as const) {
      const r = ramp(c);
      g.rect(x, 18, 8, 6, r.base);
      g.rect(x, 18, 8, 1, r.light);
      g.rect(x + 7, 19, 1, 5, r.dark);
    }
  });
}

/** A enfermaria: tenda de lona com a cruz vermelha na frente. */
function infirmary(): Piece {
  return piece(76, 52, 38, 48, (g) => {
    // O telhado em duas águas e a frente em triângulo
    g.poly(
      [
        [4, 46],
        [38, 4],
        [72, 46],
      ],
      CANVAS.base,
    );
    g.poly(
      [
        [38, 4],
        [72, 46],
        [60, 46],
        [38, 14],
      ],
      CANVAS.dark,
    );
    g.line(38, 4, 4, 46, CANVAS.light);
    // A entrada aberta, com a sombra lá dentro
    g.poly(
      [
        [30, 46],
        [38, 30],
        [46, 46],
      ],
      0x3a3228,
    );
    // A cruz
    g.rect(36, 13, 4, 14, CROSS);
    g.rect(31, 18, 14, 4, CROSS);
    g.rect(2, 46, 72, 2, CANVAS.dark);
  });
}

/** Uma esteira de palha onde deita um ferido. */
function cot(): Piece {
  return piece(26, 12, 13, 10, (g) => {
    g.rect(1, 2, 24, 8, STRAW.base);
    g.rect(1, 2, 24, 1, STRAW.light);
    g.rect(1, 9, 24, 1, STRAW.dark);
    g.rect(2, 3, 5, 6, 0xe8e0cc);
  });
}

/** Púlpito de caixotes, com o estandarte branco no mastro. */
function pulpit(): Piece {
  return piece(52, 52, 18, 48, (g) => {
    g.rect(32, 4, 2, 44, WOOD.dark);
    g.rect(34, 5, 16, 12, 0xf5f0e0);
    g.rect(34, 16, 16, 1, 0xc8c0a8);
    g.rect(41, 7, 2, 8, 0xc9a23a);
    g.rect(38, 9, 8, 2, 0xc9a23a);
    for (const [x, y, w, h] of [
      [4, 30, 26, 18],
      [8, 20, 18, 11],
    ] as const) {
      g.rect(x, y, w, h, WOOD.base);
      g.rect(x, y, w, 2, WOOD.light);
      g.rect(x, y + h - 1, w, 1, WOOD.dark);
      g.line(x + 1, y + 2, x + w - 2, y + h - 2, WOOD.dark);
    }
  });
}

/** Bigorna num toco, o balde d'água e a pilha de ferro. */
function anvil(): Piece {
  return piece(70, 32, 34, 28, (g) => {
    g.oval(10, 22, 7, 5, WATER);
    g.oval(10, 20, 7, 2, 0x4a7a9a);
    g.rect(3, 20, 1, 5, WOOD.dark);
    g.rect(17, 20, 1, 5, WOOD.dark);
    // O toco e a bigorna em cima, com o chifre para a direita
    g.rect(26, 16, 16, 12, WOOD.base);
    g.oval(34, 16, 8, 2, WOOD.light);
    g.rect(24, 9, 20, 5, IRON.base);
    g.rect(24, 9, 20, 1, IRON.light);
    g.poly(
      [
        [44, 9],
        [52, 11],
        [44, 13],
      ],
      IRON.base,
    );
    g.rect(29, 14, 10, 3, IRON.dark);
    // As barras de ferro
    for (let k = 0; k < 3; k++) {
      g.rect(54, 18 + k * 4, 14, 3, BAR.base);
      g.rect(54, 18 + k * 4, 14, 1, BAR.light);
    }
  });
}

/** Varal entre dois paus, com a roupa estendida. */
function clothesline(): Piece {
  return piece(146, 36, 20, 32, (g) => {
    for (const x of [9, 139]) g.rect(x, 2, 2, 30, WOOD.dark);
    for (let x = 10; x < 140; x++) g.px(x, 4 + Math.round(Math.sin(((x - 10) / 130) * Math.PI) * 2), 0xd8d0b8);
    const colors = [0xc0392b, 0x2e86c1, 0xf5f0e0, 0x7d6608, 0x6c3483, 0x5a8a4a];
    for (let k = 0; k < 6; k++) {
      const x = 22 + k * 19;
      const sag = Math.round(Math.sin(((x - 10) / 130) * Math.PI) * 2);
      const r = ramp(colors[k]);
      g.rect(x, 5 + sag, 11, 13 - (k % 2) * 3, r.base);
      g.rect(x, 5 + sag, 11, 1, r.light);
      g.rect(x + 10, 6 + sag, 1, 12 - (k % 2) * 3, r.dark);
    }
  });
}

/** As peças de cada lugar de trabalho, com o ponto de cada uma em relação ao do seguidor. */
export function stationPieces(role: StationRole): { dx: number; dy: number; make: () => Piece; flat?: boolean }[] {
  switch (role) {
    // O cozinheiro fica na frente do caldeirão
    case "COOK":
      return [{ dx: 0, dy: -6, make: cauldron }];
    // O mascate atrás do balcão
    case "PEDDLER":
      return [{ dx: 0, dy: 16, make: stall }];
    // A curandeira à porta; as esteiras são as dos feridos (ver `CampLife.cot`)
    case "HEALER":
      return [
        { dx: 0, dy: -4, make: infirmary },
        // Rentes ao chão: o ferido deitado fica por cima da esteira
        ...Array.from({ length: 10 }, (_, k) => ({ dx: -60 + (k % 5) * 30, dy: 46 + Math.floor(k / 5) * 26, make: cot, flat: true })),
      ];
    // O capelão atrás do púlpito
    case "CHAPLAIN":
      return [{ dx: 0, dy: 8, make: pulpit }];
    // O ajudante ao lado da bigorna
    case "SMITH":
      return [{ dx: 20, dy: -2, make: anvil }];
    // As famílias andam na frente do varal
    case "FAMILY":
      return [{ dx: 0, dy: -10, make: clothesline }];
  }
}

/** A carga de ferro nas costas (três barras amarradas). */
export function ironLoadBitmap(): Bitmap {
  const g = new Grid(16, 9);
  for (let k = 0; k < 3; k++) {
    g.rect(1, 1 + k * 2, 14, 2, k === 0 ? BAR.light : BAR.base);
  }
  g.rect(5, 1, 1, 6, 0x6b4a2b);
  g.rect(10, 1, 1, 6, 0x6b4a2b);
  g.outline();
  return gridBitmap(g);
}
