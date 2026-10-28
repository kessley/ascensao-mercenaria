import type { Enemy } from "../entities/Enemy";
import type { WarbandsSave } from "../systems/Warbands";
import { SAVE, type EnemyKind } from "../../utils/constants";

/**
 * Salvar e carregar (Marco 10).
 * O save NÃO guarda o mapa: guarda a semente (o mundo é gerado de novo, igual), o estado da
 * campanha (store) e o retrato do campo (posições, névoa explorada, bandos, inimigos vivos).
 * Fica no armazenamento local do navegador/WebView (no app Tauri, na pasta de dados do app).
 */

/** Inimigo de um local (contrato, cerco, covil de calamidade) com a vida que tinha. */
export interface EnemySave {
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  color?: number;
  owner: Enemy["owner"];
}

/** Retrato do campo: o que só a cena sabe. */
export interface FieldSave {
  commander: { x: number; y: number; hp: number; facing: number };
  /** Batalhões descansando nos alojamentos. */
  quartered: string[];
  battalions: { id: string; x: number; y: number; morale: number }[];
  scouts: { id: string; x: number; y: number; hp: number }[];
  messengers: { id: string; x: number; y: number }[];
  /** Névoa já explorada (compactada). */
  fog: string;
  warbands: WarbandsSave;
  enemies: EnemySave[];
  torches: boolean;
}

export interface SaveFile {
  version: number;
  slot: string;
  savedAt: string;
  seed: number;
  /** Conferido na carga: o mundo gerado de novo tem de ser o mesmo. */
  worldName: string;
  bandName: string;
  day: number;
  /** Estado da campanha (store, sem o mundo e sem a interface). */
  store: Record<string, unknown>;
  field: FieldSave | null;
}

export interface SaveMeta {
  slot: string;
  savedAt: string;
  worldName: string;
  bandName: string;
  day: number;
}

export const AUTO_SLOT = "auto";
export const MANUAL_SLOTS = Array.from({ length: SAVE.SLOTS }, (_, i) => String(i + 1));

const PREFIX = "ascensao-mercenaria.save.";

export function slotLabel(slot: string): string {
  return slot === AUTO_SLOT ? "Automático" : `Espaço ${slot}`;
}

export function writeSave(file: SaveFile): string | null {
  try {
    localStorage.setItem(PREFIX + file.slot, JSON.stringify(file));
    return null;
  } catch {
    return "Não foi possível gravar o save (armazenamento cheio ou bloqueado).";
  }
}

export function readSave(slot: string): SaveFile | null {
  try {
    const raw = localStorage.getItem(PREFIX + slot);
    return raw ? (JSON.parse(raw) as SaveFile) : null;
  } catch {
    return null;
  }
}

export function deleteSave(slot: string): void {
  try {
    localStorage.removeItem(PREFIX + slot);
  } catch {
    // sem armazenamento: nada a apagar
  }
}

/** Saves existentes (automático primeiro, depois os espaços), do mais recente ao mais antigo. */
export function listSaves(): SaveMeta[] {
  const out: SaveMeta[] = [];
  for (const slot of [AUTO_SLOT, ...MANUAL_SLOTS]) {
    const f = readSave(slot);
    if (!f || f.version !== SAVE.VERSION) continue;
    out.push({ slot, savedAt: f.savedAt, worldName: f.worldName, bandName: f.bandName, day: f.day });
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

// --- Ponte com a cena: só ela sabe montar o retrato do campo ---

type FieldCapture = () => FieldSave | string;
let fieldCapture: FieldCapture | null = null;

/** A cena do mundo registra quem monta o retrato do campo. */
export function registerFieldCapture(fn: FieldCapture): void {
  fieldCapture = fn;
}

/**
 * A cena destruída tira o próprio registro (o Phaser antigo é destruído um quadro depois
 * do novo ser criado, ao carregar um jogo: ele não pode apagar o registro da cena nova).
 */
export function unregisterFieldCapture(fn: FieldCapture): void {
  if (fieldCapture === fn) fieldCapture = null;
}

/** Retrato do campo, ou o motivo de não dar para salvar agora (ex.: em combate). */
export function captureField(): FieldSave | string | null {
  return fieldCapture ? fieldCapture() : null;
}
