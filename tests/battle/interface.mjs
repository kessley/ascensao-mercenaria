/**
 * A interface em pixel art (G5): a fonte desenhada por código, nos títulos, números, rótulos e
 * botões da interface e nos nomes do mapa. As fotos ficam em `tests/battle/.shots-g5-*.png`.
 */
const ready = (page) => page.waitForFunction(() => window.__world && !window.__world.run && window.__store.getState().battleHud && !window.__world.scene.isPaused(), null, { timeout: 60000 });

export async function ui({ page, ev }, { check }) {
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("nav >> text=Nova campanha");

  // --- Parte 1: a fonte ---
  const font = await ev(() => ({
    faces: [...document.fonts].filter((f) => f.family.includes("Mercenaria")).map((f) => `${f.weight}:${f.status}`),
    check: document.fonts.check('12px "Mercenaria Pixel"') && document.fonts.check('bold 12px "Mercenaria Pixel"'),
  }));
  console.log("   fonte:", JSON.stringify(font));
  check("a fonte de pixel é aceita pelo navegador, regular e negrito", font.check && font.faces.includes("400:loaded") && font.faces.includes("700:loaded"), JSON.stringify(font));
  // O título do menu e as entradas usam a fonte
  const menu = await ev(() => {
    const title = document.querySelector("h1");
    return { title: title ? getComputedStyle(title).fontFamily : null };
  });
  check("o título do menu é em pixel", /Mercenaria Pixel/.test(menu.title ?? ""), JSON.stringify(menu));
  await page.screenshot({ path: "tests/battle/.shots-g5-menu.png" });

  await page.click("nav >> text=Nova campanha");
  await page.waitForSelector("text=Começar campanha");
  await page.click("text=Começar campanha");
  await ready(page);
  await page.waitForTimeout(1200);

  // Os nomes do mapa (Phaser) e os números do HUD
  const hud = await ev(() => {
    const w = window.__world;
    const b = w.battalions[0];
    const mono = [...document.querySelectorAll(".font-mono")][0];
    return {
      label: b?.label?.style?.fontFamily ?? null,
      size: b?.label?.style?.fontSize ?? null,
      mono: mono ? { family: getComputedStyle(mono).fontFamily, size: getComputedStyle(mono).fontSize } : null,
    };
  });
  console.log("   hud:", JSON.stringify(hud));
  check("o nome do batalhão no mapa é em pixel, em 12 px", /Mercenaria Pixel/.test(hud.label ?? "") && hud.size === "12px", JSON.stringify(hud));
  check("os números do HUD são em pixel, num tamanho inteiro", /Mercenaria Pixel/.test(hud.mono?.family ?? "") && hud.mono?.size === "12px", JSON.stringify(hud.mono));
  // De perto, o nome e o estandarte do batalhão
  await ev(() => {
    const w = window.__world;
    w.cameras.main.setZoom(2);
    w.cameras.main.centerOn(w.battalions[0].center.x, w.battalions[0].center.y - 20);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "tests/battle/.shots-g5-estandarte.png" });
  await ev(() => window.__world.cameras.main.setZoom(1));

  // Um painel com títulos e rótulos de seção
  await ev(() => window.__store.getState().setCampPanel({ kind: "CAMP_PLAN" }));
  await page.waitForTimeout(500);
  const panel = await ev(() => {
    const h = document.querySelector("h3");
    return h ? { family: getComputedStyle(h).fontFamily, size: getComputedStyle(h).fontSize, text: h.textContent } : null;
  });
  console.log("   painel:", JSON.stringify(panel));
  check("os rótulos de seção dos painéis são em pixel", /Mercenaria Pixel/.test(panel?.family ?? "") && panel?.size === "12px", JSON.stringify(panel));

  // --- Parte 2: as molduras e os botões ---
  const frames = await ev(() => {
    const art = (el) => (el ? getComputedStyle(el).borderImageSource : "");
    const aside = document.querySelector("aside.frame-wood");
    const hud = document.querySelector(".hud-box");
    const btn = document.querySelector(".btn-pixel");
    const card = aside?.querySelector(".bg-neutral-800");
    return {
      root: getComputedStyle(document.documentElement).getPropertyValue("--art-frame-wood").slice(0, 30),
      aside: art(aside).slice(0, 30),
      hud: art(hud).slice(0, 30),
      button: art(btn).slice(0, 30),
      // Dentro da madeira, o cinza vira madeira
      card: card ? getComputedStyle(card).backgroundColor : null,
    };
  });
  console.log("   molduras:", JSON.stringify(frames));
  const png = (s) => s.includes("data:image/png");
  check("as molduras de madeira, ferro e os botões são imagens feitas pelo jogo", png(frames.root) && png(frames.aside) && png(frames.hud) && png(frames.button), JSON.stringify(frames));
  check("dentro da moldura de madeira, os cartões ficam cor de madeira", frames.card === "rgb(46, 35, 26)", frames.card);
  await page.screenshot({ path: "tests/battle/.shots-g5-painel.png" });
  // O diário, em pergaminho
  await ev(() => window.__store.getState().setCampPanel({ kind: "TENT" }));
  await page.waitForTimeout(500);
  const journal = await ev(() => {
    const ol = document.querySelector("ol.frame-parchment");
    return ol ? getComputedStyle(ol).borderImageSource.slice(0, 30) : null;
  });
  check("o diário é um pergaminho", !!journal && journal.includes("data:image/png"), journal);
  await page.screenshot({ path: "tests/battle/.shots-g5-tenda.png" });
  await ev(() => document.querySelector("ol.frame-parchment")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: "tests/battle/.shots-g5-diario.png" });
  await ev(() => window.__store.getState().setCampPanel(null));
  await page.waitForTimeout(300);
  await page.screenshot({ path: "tests/battle/.shots-g5-hud.png" });
  // Fora do acampamento: a barra de comando, com os botões de ferro
  await ev(() => {
    const w = window.__world;
    const p = w.campArea.palisade;
    w.commander.x = p.cx;
    w.commander.y = p.cy + p.half + 260;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "tests/battle/.shots-g5-comando.png" });

  // --- Parte 3: os ícones ---
  // Os sinais que viravam emoji ou fonte do sistema: nenhum pode sobrar como texto na interface
  const SYMBOLS = "⚑★✓✗✕☠♛👑⚔⚓✉↩✦⚠🔒📖🔥⛺🛒🎒⚖☾☀◐⏸☔🌫❄⛈🌾🥩🧂🪵⛓🧵🍺🐎💎";
  const leftovers = (sym) => ev((s) => [...s].filter((c) => document.getElementById("root").innerText.includes(c)), sym);
  const bar = await ev(() => {
    const icons = [...document.querySelectorAll(".btn-pixel img.pixel-icon")];
    return { icons: icons.length, png: icons.every((i) => i.src.startsWith("data:image/png")), ids: [...new Set(icons.map((i) => i.dataset.icon))].slice(0, 8) };
  });
  console.log("   barra:", JSON.stringify(bar));
  check("os botões da barra de comando são ícones de pixel", bar.icons >= 6 && bar.png, JSON.stringify(bar));
  const hudIcons = await ev(() => [...document.querySelectorAll(".hud-box img.pixel-icon")].map((i) => i.dataset.icon));
  check("o HUD mostra ouro, rações e ferro em ícone", ["GOLD", "FOOD", "IRON"].every((id) => hudIcons.includes(id)), JSON.stringify(hudIcons.slice(0, 12)));
  const hudLeft = await leftovers(SYMBOLS);
  check("nenhum emoji sobra no HUD de campo", hudLeft.length === 0, hudLeft.join(" "));
  await page.screenshot({ path: "tests/battle/.shots-g5-icones-hud.png" });

  // A planta do acampamento: cada construção com o seu ícone
  await ev(() => window.__store.getState().setCampPanel({ kind: "CAMP_PLAN" }));
  await page.waitForTimeout(500);
  const plan = await ev(() => {
    const icons = [...document.querySelectorAll("aside img.pixel-icon")].map((i) => i.dataset.icon);
    return { total: icons.length, distinct: new Set(icons).size };
  });
  console.log("   planta:", JSON.stringify(plan));
  check("a planta mostra um ícone para cada construção", plan.distinct >= 40, JSON.stringify(plan));
  const planLeft = await leftovers(SYMBOLS);
  check("nenhum emoji sobra na planta", planLeft.length === 0, planLeft.join(" "));
  await page.screenshot({ path: "tests/battle/.shots-g5-icones-planta.png" });

  // A tenda, com o quadro de comando e o diário
  await ev(() => window.__store.getState().setCampPanel({ kind: "TENT" }));
  await page.waitForTimeout(500);
  const tentLeft = await leftovers(SYMBOLS);
  check("nenhum emoji sobra na tenda, no quadro de comando e no diário", tentLeft.length === 0, tentLeft.join(" "));
  await page.screenshot({ path: "tests/battle/.shots-g5-icones-tenda.png" });
  await ev(() => window.__store.getState().setCampPanel(null));
}
