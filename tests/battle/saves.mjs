/**
 * Saves antigos (etapa 17, parte 2): saves gravados de verdade em commits antigos carregam no código de agora.
 * Os arquivos em `saves/` saíram do próprio jogo, cada um no seu commit:
 * - `fase2`: fim da Fase 2 (578bf75), com tenentes, herdeiro, contrato, presos e carta náutica;
 * - `sede`: Marco 19, parte 3 (6b0354e), com a fortaleza, magias, capitão com companhia e a planta do acampamento;
 * - `ultramar-fase2` e `ultramar-sede`: os mesmos dois, gravados do outro lado do mar, com a terra de casa guardada.
 */
import fs from "node:fs";
import zlib from "node:zlib";

const read = (name) => JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(`./saves/${name}.json.gz`, import.meta.url))).toString("utf8"));
const ready = (page) =>
  page.waitForFunction(
    () => {
      try {
        return !!(window.__world && !window.__world.run && window.__store.getState().battleHud && !window.__store.getState().voyage && !window.__world.scene.isPaused());
      } catch {
        return false;
      }
    },
    null,
    { timeout: 60000 },
  );

/** Carrega o save no slot 1, do menu principal, como o jogador faria. */
async function load(page, ev, save) {
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");
  await ev((raw) => {
    localStorage.clear();
    localStorage.setItem("ascensao-mercenaria.save.1", raw);
  }, JSON.stringify(save));
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");
  const why = await ev(() => window.__store.getState().loadGame("1"));
  if (why === null) {
    await ready(page);
    await page.waitForTimeout(1500);
  }
  return why;
}

/** Números quebrados no estado (NaN), e os painéis que deixam a tela vazia. */
function inspect() {
  const s = window.__store.getState();
  const bad = [];
  const walk = (v, path, depth) => {
    if (depth > 7 || bad.length > 8) return;
    if (typeof v === "number" && Number.isNaN(v)) bad.push(path);
    else if (Array.isArray(v)) v.slice(0, 60).forEach((x, i) => walk(x, `${path}[${i}]`, depth + 1));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (typeof x !== "function" && k !== "world") walk(x, `${path}.${k}`, depth + 1);
  };
  walk(s, "s", 0);
  return bad;
}

async function panels(page, ev) {
  const list = await ev(() => {
    const s = window.__store.getState();
    const town = s.settlements[0]?.id;
    const out = ["TENT", "QUARTERMASTER", "RECRUIT", "TRAINING", "FORGE", "CAMP_PLAN", "SUPPLY", "STABLE", "PRICE_BOOK", "DEPARTURE", "NOBILITY", "GAME", "MISSIONS", "SAGA"].map((kind) => ({ kind }));
    for (const b of s.battalions) out.push({ kind: "BATTALION", battalionId: b.id });
    for (const l of s.lieutenants) out.push({ kind: "LIEUTENANT", lieutenantId: l.id });
    for (const c of s.captains ?? []) out.push({ kind: "CAPTAIN", captainId: c.id });
    for (const at of ["MARKET", "HALL", "GATE"]) out.push({ kind: "TOWN", settlementId: town, at });
    return out;
  });
  const blank = [];
  for (const p of list) {
    await ev((p) => window.__store.getState().setCampPanel(p), p);
    await page.waitForTimeout(150);
    if (await ev(() => !document.querySelector("#root")?.children.length)) blank.push(p.kind);
  }
  await ev(() => window.__store.getState().setCampPanel(null));
  await ev(() => window.__store.getState().setWorldMapOpen(true));
  await page.waitForTimeout(400);
  await ev(() => window.__store.getState().setWorldMapOpen(false));
  return { opened: list.length, blank };
}

/** Grava no slot 2 e carrega de volta. */
async function roundTrip(page, ev) {
  const saved = await ev(() => window.__store.getState().saveGame("2"));
  const loaded = await ev(() => window.__store.getState().loadGame("2"));
  if (loaded === null) await ready(page);
  return { saved, loaded };
}

export async function saves({ page, ev }, { check }) {
  // Fim da Fase 2, com um veterano do jeito antigo: as duas habilidades das duas primeiras linhas
  const fase2 = read("fase2");
  const vet = fase2.store.battalions[0];
  fase2.store.battalions[0] = { ...vet, level: 5, xp: 0, skillPoints: 0, skills: ["REINFORCED_SHIELDS", "IRON_DISCIPLINE", "LIVING_WALL", "COUNTERATTACK"] };
  const why = await load(page, ev, fase2);
  check("o save do fim da Fase 2 carrega", why === null, String(why));
  const first = await ev(() => {
    const s = window.__store.getState();
    return {
      day: s.day,
      battalions: s.battalions.length,
      field: window.__world.battalions.length,
      lieutenants: s.lieutenants.length,
      heir: !!s.heirId,
      plan: s.campPlan?.legacy === true && s.campPlan.buildings.length > 0,
      vet: { skills: s.battalions[0].skills, points: s.battalions[0].skillPoints },
    };
  });
  console.log("   fase 2:", JSON.stringify(first));
  check("o bando da Fase 2 volta inteiro, no campo e no store", first.battalions === 4 && first.field === 4 && first.lieutenants === 2 && first.heir, JSON.stringify(first));
  check("o acampamento fixo da Fase 2 vira a planta antiga", first.plan, JSON.stringify(first));
  check("o veterano antigo fica com uma habilidade por linha, e os pontos voltam", JSON.stringify(first.vet.skills) === JSON.stringify(["REINFORCED_SHIELDS", "LIVING_WALL"]) && first.vet.points === 2, JSON.stringify(first.vet));
  check("sem números quebrados no estado (Fase 2)", (await ev(inspect)).length === 0, JSON.stringify(await ev(inspect)));
  const p1 = await panels(page, ev);
  check("todos os painéis abrem com o save da Fase 2", p1.blank.length === 0 && p1.opened >= 20, JSON.stringify(p1));
  const days = await ev(() => {
    try {
      window.__world.passTime(3);
      return window.__store.getState().day;
    } catch (e) {
      return String(e);
    }
  });
  check("os dias passam com o save da Fase 2", typeof days === "number" && days >= first.day + 3, String(days));
  const rt1 = await roundTrip(page, ev);
  check("grava e carrega de novo (Fase 2)", rt1.saved === null && rt1.loaded === null, JSON.stringify(rt1));

  // A sede do Marco 22, com magia (Marco 19) e capitão
  const why2 = await load(page, ev, read("sede"));
  check("o save com fortaleza e magia carrega", why2 === null, String(why2));
  const seat = await ev(() => {
    const s = window.__store.getState();
    return { fortress: !!s.fortress, size: s.campPlan.size, city: !!s.seatCity, spells: s.spells?.length ?? s.knownSpells?.length ?? 0, captains: s.captains.length, company: s.captains.some((c) => c.battalionIds?.length > 0), field: window.__world.battalions.length, store: s.battalions.length };
  });
  console.log("   sede:", JSON.stringify(seat));
  check("a fortaleza volta de pé, com a cidade da sede", seat.fortress && seat.size === 34 && seat.city, JSON.stringify(seat));
  check("magias, capitão e companhia voltam", seat.spells >= 2 && seat.captains >= 1 && seat.company && seat.field === seat.store, JSON.stringify(seat));
  check("sem números quebrados no estado (sede)", (await ev(inspect)).length === 0, JSON.stringify(await ev(inspect)));
  const p2 = await panels(page, ev);
  check("todos os painéis abrem com o save da sede", p2.blank.length === 0, JSON.stringify(p2));
  const rt2 = await roundTrip(page, ev);
  check("grava e carrega de novo (sede)", rt2.saved === null && rt2.loaded === null, JSON.stringify(rt2));

  // Do outro lado do mar, nas duas épocas: carrega lá e volta para casa
  for (const name of ["ultramar-fase2", "ultramar-sede"]) {
    const save = read(name);
    const home = { name: save.store.planet.continents.find((c) => c.home).name, town: save.store.parked.C0.store.settlements[0].name, seat: !!save.store.parked.C0.store.fortress };
    const why3 = await load(page, ev, save);
    check(`${name}: carrega do outro lado do mar`, why3 === null && (await ev(() => window.__store.getState().continent)) !== "C0", String(why3));
    const sail = await ev(() => {
      const st = window.__store;
      st.setState({ activeContract: null, gold: st.getState().gold + 20000, rations: 900 });
      const s = st.getState();
      const port = s.settlements.find((t) => t.port && t.owner !== "RUINED") ?? s.settlements[0];
      const why = s.embark({ to: "C0", portId: port.id, battalionIds: s.battalions.map((b) => b.id), wagons: 0, ship: "COCA" });
      for (let i = 0; i < 200 && st.getState().voyage; i++) {
        const v = st.getState();
        if (v.voyage.pirates) v.answerPirates("PAY");
        else v.sailDay();
      }
      return why;
    });
    await page.waitForTimeout(500);
    await ready(page);
    await page.waitForTimeout(1200);
    const back = await ev(() => {
      const s = window.__store.getState();
      return { continent: s.continent, name: s.world.name, town: s.settlements[0]?.name, fortress: !!s.fortress, field: window.__world.battalions.length, store: s.battalions.length };
    });
    console.log(`   ${name}:`, JSON.stringify({ home, back }));
    check(`${name}: volta para a mesma terra de casa`, sail === null && back.continent === "C0" && back.name === home.name && back.town === home.town && back.field === back.store, JSON.stringify({ sail, home, back }));
    check(`${name}: a fortaleza de casa continua lá`, back.fortress === home.seat, JSON.stringify(back));
    const rt = await roundTrip(page, ev);
    check(`${name}: grava e carrega de novo em casa`, rt.saved === null && rt.loaded === null, JSON.stringify(rt));
  }
}
