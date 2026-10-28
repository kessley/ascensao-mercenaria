import { FieldHudView } from "./FieldHudView";
import { PlacePanelView } from "./PlacePanelView";
import { WorldMapView } from "./WorldMapView";

/** Tudo o que o React desenha sobre o mundo: HUD, painéis dos lugares e o Mapa Múndi. */
export function WorldOverlayView() {
  return (
    <>
      <FieldHudView />
      <PlacePanelView />
      <WorldMapView />
    </>
  );
}
