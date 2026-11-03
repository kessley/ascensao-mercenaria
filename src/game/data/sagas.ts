import type { WorldOptions } from "../../utils/constants";
import { createRng } from "../worldgen/rng";
import type { LegendBook } from "../sim/legends";
import type { WorldDef } from "./world";

/**
 * Sagas terminadas (Marco 18): o livro de cada campanha encerrada fica guardado fora dos saves, e
 * o mundo dela pode ser visitado de novo séculos depois (ver `rememberSaga`).
 */

/** O que o mundo lembra de um bando. */
export interface SagaEcho {
  bandName: string;
  worldName: string;
  /** Quem comandou, do primeiro ao último. */
  leaders: string[];
  /** Povoados que eram do bando no fim. */
  towns: string[];
  /** Uma frase para os livros de história. */
  deed: string;
  /** Anos desde o fim da saga. */
  centuries: number;
}

export interface SagaRecord {
  id: string;
  endedAt: string;
  seed: number;
  options: WorldOptions;
  epilogue: string[];
  echo: SagaEcho;
  book: LegendBook;
}

const KEY = "ascensao-mercenaria.sagas";
/** Sagas guardadas: as mais antigas saem primeiro. */
const KEEP = 8;

export function loadSagas(): SagaRecord[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? (raw as SagaRecord[]) : [];
  } catch {
    return [];
  }
}

/** Guarda a saga; sem espaço, solta as mais antigas. Devolve o motivo se nem assim couber. */
export function storeSaga(saga: SagaRecord): string | null {
  const all = [saga, ...loadSagas()].slice(0, KEEP);
  for (let n = all.length; n > 0; n--) {
    try {
      localStorage.setItem(KEY, JSON.stringify(all.slice(0, n)));
      return null;
    } catch {
      // cheio: tenta com menos
    }
  }
  return "Não foi possível guardar a saga (armazenamento cheio ou bloqueado).";
}

const ERAS_AFTER = ["Era das Velhas Bandeiras", "Era dos Netos", "Era da Memória Curta", "Era Depois do Estandarte"];

/** Quantos anos se passaram: sempre o mesmo número para a mesma saga. */
export function yearsLater(seed: number, bandName: string): number {
  const rng = createRng((seed ^ bandName.length * 2654435761) >>> 0 || 1);
  return rng.int(180, 420);
}

/**
 * Mesma semente, séculos depois: o relevo é o mesmo, e o bando antigo entrou para a história. Um
 * povoado que ele governou lembra disso, e as ruínas mais velhas guardam o túmulo do último chefe.
 */
export function rememberSaga(world: WorldDef, echo: SagaEcho): void {
  const rng = createRng(world.seed || 1);
  const last = echo.leaders[echo.leaders.length - 1] ?? "o último Comandante";
  world.year += echo.centuries;
  world.era = rng.pick(ERAS_AFTER);
  world.history = [
    ...world.history,
    { year: world.year - echo.centuries, text: `Os ${echo.bandName} chegam ao fim. ${echo.deed}` },
    ...echo.leaders.map((name) => ({ year: world.year - echo.centuries, text: `As canções dos ${echo.bandName} ainda falam de ${name}.` })),
  ];
  for (const t of world.settlements) {
    if (echo.towns.includes(t.name)) t.description = `${t.description} Dizem que aqui governaram os ${echo.bandName}, há ${echo.centuries} anos.`;
  }
  const tomb = world.sites.find((s) => s.theme === "HAUNTED_RUINS") ?? world.sites[0];
  if (tomb) tomb.name = `Túmulo de ${last}`;
}
