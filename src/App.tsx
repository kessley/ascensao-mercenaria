import { useGameStore } from "./store/useGameStore";
import { GameEngine } from "./ui/GameEngine";
import { NewWorldView } from "./ui/views/NewWorldView";
import { WorldOverlayView } from "./ui/views/WorldOverlayView";

function App() {
  const phase = useGameStore((s) => s.phase);
  const seed = useGameStore((s) => s.world?.seed);
  const loadNonce = useGameStore((s) => s.loadNonce);

  // Cada campanha gera um mundo novo: escolha a semente (ou continue um save) antes de começar
  if (phase === "NEW_GAME") return <NewWorldView />;

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Um único mundo contínuo: acampamento, povoados e combate no mesmo mapa (mundo novo ou jogo carregado = Phaser novo) */}
      <GameEngine key={`${seed}-${loadNonce}`} />
      <WorldOverlayView />
    </div>
  );
}

export default App;
