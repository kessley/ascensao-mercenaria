import { FieldHudView } from "./FieldHudView";
import { PlacePanelView } from "./PlacePanelView";
import { WorldMapView } from "./WorldMapView";
import { InteriorView } from "./InteriorView";
import { CapitalView } from "./CapitalView";
import { CampEventView } from "../components/CampEventView";
import { ScenarioOverlay } from "../components/scenario/ScenarioOverlay";
import { useGameStore } from "../../store/useGameStore";

/**
 * Tudo o que o React desenha sobre o mundo: HUD, painéis dos lugares e o Mapa do Continente.
 * Dentro de um prédio (Marco 14) ou na Cidade Alta (Marco 15), o HUD do campo dá lugar ao de lá.
 */
export function WorldOverlayView() {
  const inside = useGameStore((s) => s.interior !== null);
  const city = useGameStore((s) => s.city !== null);
  const duel = useGameStore((s) => s.duel !== null);
  // No duelo a tela é da Liça (Marco 15): a própria cena mostra as barras
  if (duel) return <CampEventView />;
  return (
    <>
      {inside ? <InteriorView /> : city ? <CapitalView /> : <FieldHudView />}
      <PlacePanelView />
      {!inside && !city && <WorldMapView />}
      <CampEventView />
      <ScenarioOverlay />
    </>
  );
}
