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
  await page.screenshot({ path: "tests/battle/.shots-g5-painel.png" });
  await ev(() => window.__store.getState().setCampPanel(null));
}
