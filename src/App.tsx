import { Suspense, lazy } from "react";
import { useGameStore } from "./store/useGameStore";
import { GameEngine } from "./ui/GameEngine";
import { MainMenuView } from "./ui/views/MainMenuView";
import { WorldOverlayView } from "./ui/views/WorldOverlayView";

/** O painel do diário de ritmo (F9), só no modo de desenvolvimento. */
const PacePanel = import.meta.env.DEV ? lazy(() => import("./dev/PacePanel")) : null;

function App() {
  const phase = useGameStore((s) => s.phase);
  const seed = useGameStore((s) => s.world?.seed);
  const loadNonce = useGameStore((s) => s.loadNonce);

  // Menu inicial: campanha, batalhas personalizadas e saves
  if (phase === "NEW_GAME") return <MainMenuView />;

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Um único mundo contínuo: acampamento, povoados e combate no mesmo mapa (mundo novo ou jogo carregado = Phaser novo) */}
      <GameEngine key={`${seed}-${loadNonce}`} />
      <WorldOverlayView />
      {PacePanel && (
        <Suspense fallback={null}>
          <PacePanel />
        </Suspense>
      )}
    </div>
  );
}

export default App;
