import { useGameStore } from "./store/useGameStore";
import { GameEngine } from "./ui/GameEngine";
import { MainMenuView } from "./ui/views/MainMenuView";
import { WorldOverlayView } from "./ui/views/WorldOverlayView";

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
    </div>
  );
}

export default App;
