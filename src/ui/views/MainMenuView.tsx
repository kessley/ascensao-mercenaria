import { useEffect, useMemo, useState, type ReactNode } from "react";
import { listSaves } from "../../game/save/saveGame";
import { useGameStore } from "../../store/useGameStore";
import { MenuBackdrop } from "../components/menu/MenuBackdrop";
import { SavePanel } from "../components/SavePanel";
import { SoundControl } from "../components/SoundControl";
import { NewWorldView } from "./NewWorldView";
import { ScenarioView } from "./ScenarioView";

type MenuScreen = "MAIN" | "CAMPAIGN" | "BATTLE" | "LOAD" | "OPTIONS" | "HELP";

interface MenuItem {
  id: string;
  label: string;
  detail: string;
  run: () => void;
}

const HELP: { title: string; lines: string[] }[] = [
  {
    title: "O Comandante",
    lines: ["WASD move o Comandante", "Espaço dá um golpe", "R solta o grito de guerra, que levanta a moral de quem está perto", "Se ele cair, a batalha está perdida"],
  },
  {
    title: "As tropas",
    lines: ["Clique ou arraste para selecionar (Shift soma)", "Botão direito no chão marcha; num inimigo, ataca", "1 Linha · 2 Parede de Escudos · 3 Cunha · 4 Disperso", "F reúne a tropa em volta do Comandante"],
  },
  {
    title: "As ordens",
    lines: ["Perto do Comandante vale a voz: qualquer ordem", "Mais longe, só toques de trombeta e sinais de bandeira", "Além disso, a ordem vai por mensageiro, que pode ser interceptado"],
  },
  {
    title: "A câmera",
    lines: ["C prende ou solta a câmera", "Setas, borda da tela ou botão do meio movem a vista", "Roda do mouse dá zoom · H volta ao Comandante", "Tab abre o Mapa do Continente na campanha"],
  },
];

/** Moldura das telas secundárias do menu: título, voltar e o conteúdo. */
function MenuPage({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="relative z-10 mx-auto flex h-full w-full max-w-3xl flex-col gap-5 overflow-y-auto px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-3xl tracking-wide text-amber-100">{title}</h2>
        <button type="button" onClick={onBack} className="rounded border border-neutral-600 px-3 py-1.5 text-sm text-neutral-200 hover:border-amber-400">
          Voltar
        </button>
      </header>
      {children}
    </div>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Tela inicial: campanha, batalhas personalizadas, saves e opções. */
export function MainMenuView() {
  const loadGame = useGameStore((s) => s.loadGame);
  const menuTarget = useGameStore((s) => s.menuTarget);
  const [screen, setScreen] = useState<MenuScreen>(menuTarget ? "BATTLE" : "MAIN");
  const [active, setActive] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  // Relido ao voltar para a tela principal: um save pode ter sido carregado ou gravado
  const saves = useMemo(() => (screen === "MAIN" ? listSaves() : []), [screen]);
  const last = saves[0];

  const items: MenuItem[] = [
    ...(last
      ? [
          {
            id: "continue",
            label: "Continuar",
            detail: `${last.bandName} · dia ${last.day}`,
            run: () => setProblem(loadGame(last.slot)),
          },
        ]
      : []),
    { id: "campaign", label: "Nova campanha", detail: "Um mundo novo, gerado para você", run: () => setScreen("CAMPAIGN") },
    { id: "battle", label: "Batalha personalizada", detail: "Escolha ou monte um cenário de combate", run: () => setScreen("BATTLE") },
    ...(saves.length > 0 ? [{ id: "load", label: "Carregar jogo", detail: `${saves.length} save${saves.length > 1 ? "s" : ""}`, run: () => setScreen("LOAD") }] : []),
    { id: "help", label: "Como jogar", detail: "Controles e ordens", run: () => setScreen("HELP") },
    { id: "options", label: "Opções", detail: "Som", run: () => setScreen("OPTIONS") },
  ];

  useEffect(() => {
    if (screen !== "MAIN") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") setActive((i) => (i + 1) % items.length);
      else if (e.key === "ArrowUp") setActive((i) => (i - 1 + items.length) % items.length);
      else if (e.key === "Enter") items[active]?.run();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (screen === "MAIN" || screen === "CAMPAIGN" || screen === "BATTLE") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScreen("MAIN");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  const back = () => setScreen("MAIN");
  if (screen === "CAMPAIGN") return <NewWorldView onBack={back} />;
  if (screen === "BATTLE") return <ScenarioView onBack={back} initialId={menuTarget} />;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-neutral-950 text-white">
      <MenuBackdrop />
      {screen === "MAIN" && (
        <div className="relative z-10 flex h-full flex-col justify-center gap-8 px-[7vw] py-8">
          <header>
            <p className="text-xs uppercase tracking-[0.45em] text-amber-300/80">Mercenários · Reinos · Guerra</p>
            <h1 className="mt-2 font-serif text-5xl font-bold uppercase leading-[1.05] tracking-[0.08em] text-amber-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] md:text-6xl">
              Ascensão
              <br />
              Mercenária
            </h1>
          </header>
          <nav aria-label="Menu principal" className="flex w-[22rem] max-w-full flex-col">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={item.run}
                className={`group flex flex-col border-l-2 py-2 pl-4 pr-3 text-left outline-none transition-colors ${
                  i === active ? "border-amber-400 bg-gradient-to-r from-amber-500/15 to-transparent" : "border-white/10"
                }`}
              >
                <span className={`font-serif text-xl tracking-wide ${i === active ? "text-amber-100" : "text-neutral-300"}`}>{item.label}</span>
                <span className={`text-xs ${i === active ? "text-amber-200/80" : "text-neutral-500"}`}>{item.detail}</span>
              </button>
            ))}
          </nav>
          {problem && <p className="w-[22rem] max-w-full rounded border border-red-700 bg-red-950/70 px-3 py-2 text-sm text-red-100">{problem}</p>}
          <footer className="absolute bottom-5 left-[7vw] right-[7vw] flex items-center justify-between gap-4 text-xs text-neutral-500">
            <span>↑ ↓ navegar · Enter confirmar</span>
            {last && <span className="hidden sm:inline">Último save: {when(last.savedAt)}</span>}
          </footer>
        </div>
      )}
      {screen === "LOAD" && (
        <MenuPage title="Carregar jogo" onBack={back}>
          <div className="rounded-lg border border-white/10 bg-neutral-950/85 p-4">
            <SavePanel canSave={false} />
          </div>
        </MenuPage>
      )}
      {screen === "OPTIONS" && (
        <MenuPage title="Opções" onBack={back}>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-neutral-950/85 p-4">
            <div>
              <h3 className="font-semibold text-neutral-100">Som</h3>
              <p className="text-sm text-neutral-400">Volume geral do jogo. A tecla M liga e desliga o som durante a partida.</p>
            </div>
            <SoundControl />
          </div>
        </MenuPage>
      )}
      {screen === "HELP" && (
        <MenuPage title="Como jogar" onBack={back}>
          <div className="grid gap-3 sm:grid-cols-2">
            {HELP.map((group) => (
              <section key={group.title} className="rounded-lg border border-white/10 bg-neutral-950/85 p-4">
                <h3 className="mb-2 font-serif text-lg text-amber-100">{group.title}</h3>
                <ul className="flex flex-col gap-1 text-sm text-neutral-300">
                  {group.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </MenuPage>
      )}
    </div>
  );
}
