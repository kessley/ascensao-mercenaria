import { loadSagas, type SagaRecord } from "../../game/data/sagas";
import { LegendBookView } from "./LegendsView";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { troopFacts } from "../../game/data/troopFacts";
import { TROOPS, type TroopType } from "../../utils/constants";
import { listSaves } from "../../game/save/saveGame";
import { useGameStore } from "../../store/useGameStore";
import { Button } from "../components/Button";
import { MenuBackdrop } from "../components/menu/MenuBackdrop";
import { SavePanel } from "../components/SavePanel";
import { SoundControl } from "../components/SoundControl";
import { NewWorldView } from "./NewWorldView";
import { ScenarioView } from "./ScenarioView";

type MenuScreen = "MAIN" | "CAMPAIGN" | "BATTLE" | "LOAD" | "OPTIONS" | "HELP" | "LEGENDS";

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
    lines: [
      "Clique ou arraste para selecionar (Shift soma) · Ctrl+A seleciona todos",
      "Botão direito no chão marcha; dois cliques correm; num inimigo, ataca",
      "Arraste com o botão direito para posicionar: a prévia mostra cada soldado",
      "Risco longo deixa a linha fina; risco curto, funda. Do lado esquerdo para o direito, a frente olha para cima",
      "1 Linha · 2 Parede de Escudos · 3 Cunha · 4 Disperso",
      "F reúne a tropa em volta do Comandante · X corre · P pausa tática",
    ],
  },
  {
    title: "As ordens",
    lines: ["Perto do Comandante vale a voz: qualquer ordem", "Mais longe, só toques de trombeta e sinais de bandeira", "Além disso, a ordem vai por mensageiro, que pode ser interceptado"],
  },
  {
    title: "A batalha",
    lines: [
      "Pegar uma tropa de lado ou por trás mata mais depressa e quebra a moral",
      "Lanças paradas e de frente seguram a investida; dispersas, não",
      "A cavalaria bate, sai e volta: N liga a investida em ciclo",
      "Flechas caem em área e acertam quem estiver lá, inclusive os seus: B cessa o fogo",
    ],
  },
  {
    title: "O cerco",
    lines: [
      "Nas batalhas personalizadas, marque Batalha de cerco e escolha atacar ou defender os muros",
      "Quem atira de cima da muralha alcança mais longe, acerta mais forte e não gasta munição",
      "A tropa ao pé da muralha ergue a escada; na escada sobe um de cada vez",
      "O aríete leva tempo para chegar ao portão: escolha por onde entrar",
      "Na defesa, deixe uma reserva atrás dos arcos para receber quem subir",
    ],
  },
  {
    title: "O legado",
    lines: [
      "L abre o Livro do Bando: testamento, ambições e as Lendas",
      "Quem cai em combate pode não se levantar, e a idade cobra a conta",
      "Morto o Comandante, herda quem está no testamento ou o tenente mais leal",
      "O jogo só acaba quando o bando acaba ou quando você encerra a saga",
      "Toda saga terminada pode ser relida, e o mundo dela revisitado séculos depois",
    ],
  },
  {
    title: "O mar",
    lines: [
      "Na praça de um porto fica o cais: cartas náuticas, navios e viagens",
      "Cada soldado ocupa 1 lugar, cada cavalo 3 e cada carroça 4: quem não couber espera no cais",
      "Shift+Tab abre o Mapa Múndi; só há rota para terras com carta",
      "Tempestade, calmaria e piratas: pague o pedágio, tente despistar ou lute no convés",
      "Lá ninguém conhece o bando. Compre o luxo onde ele nasce e venda onde ele falta",
    ],
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
  const sagas = useMemo(() => (screen === "MAIN" || screen === "LEGENDS" ? loadSagas() : []), [screen]);
  const revisitSaga = useGameStore((s) => s.revisitSaga);
  const [reading, setReading] = useState<SagaRecord | null>(null);

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
    ...(sagas.length > 0 ? [{ id: "legends", label: "Lendas", detail: `${sagas.length} saga${sagas.length > 1 ? "s" : ""} terminada${sagas.length > 1 ? "s" : ""}`, run: () => setScreen("LEGENDS") }] : []),
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
      {screen === "LEGENDS" && (
        <MenuPage title="Lendas" onBack={back}>
          <ul className="flex flex-col gap-3">
            {sagas.map((saga) => (
              <li key={saga.id} className="flex flex-col gap-2 frame-wood p-4">
                <h3 className="font-serif text-xl text-amber-100">Os {saga.echo.bandName}</h3>
                <p className="text-sm text-neutral-300">{saga.epilogue[0]}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="quiet" onClick={() => setReading(saga)}>
                    Ler a saga
                  </Button>
                  <Button variant="gold" onClick={() => revisitSaga(saga)}>
                    Voltar a {saga.echo.worldName}, {saga.echo.centuries} anos depois
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </MenuPage>
      )}
      {reading && <LegendBookView book={reading.book} onClose={() => setReading(null)} />}
      {screen === "LOAD" && (
        <MenuPage title="Carregar jogo" onBack={back}>
          <div className="frame-wood p-4">
            <SavePanel canSave={false} />
          </div>
        </MenuPage>
      )}
      {screen === "OPTIONS" && (
        <MenuPage title="Opções" onBack={back}>
          <div className="flex items-center justify-between gap-4 frame-wood p-4">
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
              <section key={group.title} className="frame-wood p-4">
                <h3 className="mb-2 font-serif text-lg text-amber-100">{group.title}</h3>
                <ul className="flex flex-col gap-1 text-sm text-neutral-300">
                  {group.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            ))}
            <section className="frame-wood p-4 sm:col-span-2">
              <h3 className="mb-2 font-serif text-lg text-amber-100">As tropas</h3>
              <ul className="flex flex-col gap-2 text-sm text-neutral-300">
                {(Object.keys(TROOPS) as TroopType[]).map((t) => (
                  <li key={t}>
                    <b className="text-neutral-100">{TROOPS[t].label}.</b> {TROOPS[t].hint}
                    <span className="block text-xs text-neutral-500">{troopFacts(t).join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </MenuPage>
      )}
    </div>
  );
}
