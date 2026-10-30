import { FieldHudView } from "./FieldHudView";
import { PlacePanelView } from "./PlacePanelView";
import { WorldMapView } from "./WorldMapView";
import { InteriorView } from "./InteriorView";
import { CampEventView } from "../components/CampEventView";
import { useGameStore } from "../../store/useGameStore";

/**
 * Tudo o que o React desenha sobre o mundo: HUD, painéis dos lugares e o Mapa do Continente.
 * Dentro de um prédio (Marco 14), o HUD do campo dá lugar ao do interior.
 */
export function WorldOverlayView() {
  const inside = useGameStore((s) => s.interior !== null);
  return (
    <>
      {inside ? <InteriorView /> : <FieldHudView />}
      <PlacePanelView />
      {!inside && <WorldMapView />}
      <CampEventView />
    </>
  );
}
