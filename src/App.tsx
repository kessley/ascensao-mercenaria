import { useGameStore } from "./store/useGameStore";
import { GameEngine } from "./ui/GameEngine";
import { CampOverlayView } from "./ui/views/CampOverlayView";
import { BattleOverlayView } from "./ui/views/BattleOverlayView";

function App() {
  const currentScreen = useGameStore((s) => s.currentScreen);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* `key` recria o Phaser ao trocar de tela: a BootScene abre o acampamento ou a batalha */}
      <GameEngine key={currentScreen} />
      {currentScreen === "CAMP" ? <CampOverlayView /> : <BattleOverlayView />}
    </div>
  );
}

export default App;
