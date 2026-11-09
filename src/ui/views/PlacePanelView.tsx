import { SagaPanel } from "../components/legacy/SagaPanel";
import { DockPanel } from "../components/sea/DockPanel";
import { useGameStore, type CampPanel } from "../../store/useGameStore";
import { fullName, PASSIVES } from "../../game/data/lieutenants";
import { BattalionList, RecruitPanel } from "../components/tent/ArmyPanel";
import { PrisonersPanel } from "../components/tent/PrisonersPanel";
import { BattalionDetail, ForgePanel, IronTrader, TrainingPanel } from "../components/tent/ProgressionPanels";
import { LieutenantCandidates, LieutenantRoster, LieutenantSheet } from "../components/tent/LieutenantPanels";
import { CaptainCandidates, CaptainSheet, CommandBoard } from "../components/tent/CaptainPanels";
import { captainName } from "../../game/data/captains";
import { SupplyPanel } from "../components/SupplyPanel";
import { CampLog } from "../components/tent/CampLog";
import { CampStatus } from "../components/tent/CampStatus";
import { ContractBoard } from "../components/tent/ContractBoard";
import { MissionJournal } from "../components/missions/MissionJournal";
import { MarketPanel } from "../components/tent/MarketPanel";
import { MutinyBanner } from "../components/tent/MutinyBanner";
import { StablePanel } from "../components/tent/StablePanel";
import { SettlementPanel } from "../components/SettlementPanel";
import { FerryPanel } from "../components/FerryPanel";
import { DiplomacyPanel, WorldChronicle } from "../components/tent/RealmPanels";
import { FollowersPanel } from "../components/tent/FollowersPanel";
import { FaithPanel } from "../components/tent/FaithPanel";
import { GamePanel } from "../components/SavePanel";
import { BridgePanel } from "../components/BridgePanel";
import { InfirmaryPanel, PeddlerPanel, WagonPanel } from "../components/tent/LogisticsPanels";
import { CampBuildingContent, CampBuildingFooter, CampNeedsPanel, CampPlanPanel, TavernHire } from "../components/tent/CampPlanPanels";
import { CAMP_BUILDINGS, has } from "../../game/data/campGrid";
import { Button } from "../components/Button";
import { PriceBook } from "../components/trade/PriceBook";
import { GuildPanel } from "../components/trade/GuildPanel";
import { DepotPanel } from "../components/trade/DepotPanel";
import { DeparturePanel } from "../components/DeparturePanel";
import { NobilityBook } from "../components/court/NobilityBook";
import { PixelIcon } from "../components/PixelIcon";

const PANEL_TITLE: Record<CampPanel["kind"], string> = {
  TENT: "Tenda do Comandante",
  QUARTERMASTER: "Intendência",
  RECRUIT: "Posto de Recrutamento",
  TRAINING: "Campo de Treino",
  FORGE: "Ferraria",
  BATTALION: "Alojamento",
  LIEUTENANT: "Tenente",
  CAPTAIN: "Capitão",
  SUPPLY: "Suprimentos",
  STABLE: "Estábulo",
  TOWN: "Povoado",
  GAME: "Jogo",
  BRIDGE: "Ponte",
  FERRY: "Balsa",
  PEDDLER: "Banca do mascate",
  GUILD: "Casa dos Mercadores",
  TAVERN: "Taverna",
  TEMPLE: "Templo",
  PRICE_BOOK: "Livro de Preços",
  DEPARTURE: "Portão do acampamento",
  NOBILITY: "Livro da Nobreza",
  MISSIONS: "Diário de missões",
  DOCK: "Cais do porto",
  SAGA: "Livro do Bando",
  CAMP_BUILDING: "Construção",
  CAMP_PLAN: "Planta do acampamento",
};

/** Painéis fora do acampamento (ou sobre um assunto só): sem o resumo do acampamento em cima. */
const NO_STATUS = new Set<CampPanel["kind"]>(["SUPPLY", "MISSIONS", "DOCK", "SAGA", "TOWN", "GAME", "BRIDGE", "FERRY", "GUILD", "TAVERN", "TEMPLE", "PRICE_BOOK", "DEPARTURE", "NOBILITY"]);

/** Atalhos da mesa da Tenda: Livro de Preços (Marco 14) e Livro da Nobreza (Marco 15). */
function BookButton() {
  const setCampPanel = useGameStore((s) => s.setCampPanel);
  const known = useGameStore((s) => Object.keys(s.priceBook).length);
  const met = useGameStore((s) => s.nobles.filter((n) => n.met).length);
  return (
    <>
      <button
        type="button"
        onClick={() => setCampPanel({ kind: "PRICE_BOOK" })}
        className="btn-pixel btn-wood px-3 py-2 text-left text-sm"
      >
        <PixelIcon id="BOOK" /> <b>Livro de Preços</b> <span className="text-xs text-neutral-400">— {known} mercado(s) anotado(s), com a idade de cada notícia</span>
      </button>
      <button
        type="button"
        onClick={() => setCampPanel({ kind: "NOBILITY" })}
        className="btn-pixel btn-wood px-3 py-2 text-left text-sm"
      >
        <PixelIcon id="CROWN" /> <b>Livro da Nobreza</b> <span className="text-xs text-neutral-400">— {met} nobre(s) conhecido(s), favores e o nome do bando</span>
      </button>
    </>
  );
}

/** Quem comanda o batalhão (atalho para a ficha do tenente). */
function BattalionCommander({ battalionId }: { battalionId: string }) {
  const lieutenant = useGameStore((s) => s.lieutenants.find((l) => l.battalionId === battalionId));
  const setCampPanel = useGameStore((s) => s.setCampPanel);
  return (
    <section className="flex flex-col gap-1 text-sm">
      <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Comandante do batalhão</h3>
      {lieutenant ? (
        <button
          type="button"
          onClick={() => setCampPanel({ kind: "LIEUTENANT", lieutenantId: lieutenant.id })}
          className="rounded bg-neutral-800 px-3 py-2 text-left hover:bg-neutral-700"
        >
          <span className="font-semibold">{fullName(lieutenant)}</span>{" "}
          <span className="text-xs text-sky-300">
            <PixelIcon id="STAR" /> {PASSIVES[lieutenant.passive].label}
          </span>
        </button>
      ) : (
        <p className="text-xs text-neutral-500">Sem tenente. Designe um pela ficha do tenente (Tenda do Comandante).</p>
      )}
    </section>
  );
}

function PanelContent({ panel }: { panel: CampPanel }) {
  const battalion = useGameStore((s) =>
    panel.kind === "BATTALION" ? s.battalions.find((b) => b.id === panel.battalionId) : undefined,
  );
  const lieutenant = useGameStore((s) =>
    panel.kind === "LIEUTENANT" ? s.lieutenants.find((l) => l.id === panel.lieutenantId) : undefined,
  );
  const captain = useGameStore((s) => (panel.kind === "CAPTAIN" ? s.captains.find((c) => c.id === panel.captainId) : undefined));
  // Os locais de antes agora são construções da planta: o rodapé de nível, mudar e desmontar
  const content = <PanelBody panel={panel} battalion={battalion} lieutenant={lieutenant} captain={captain} />;
  const buildingId = "buildingId" in panel && panel.kind !== "CAMP_BUILDING" ? panel.buildingId : undefined;
  return (
    <>
      {content}
      {buildingId && <CampBuildingFooter buildingId={buildingId} />}
    </>
  );
}

/** O botão da tenda que abre a planta do acampamento. */
function PlanButton() {
  const setCampPanel = useGameStore((s) => s.setCampPanel);
  return (
    <Button variant="gold" onClick={() => setCampPanel({ kind: "CAMP_PLAN" })}>
      Planta do acampamento: construir
    </Button>
  );
}

function PanelBody({
  panel,
  battalion,
  lieutenant,
  captain,
}: {
  panel: CampPanel;
  battalion: ReturnType<typeof useGameStore.getState>["battalions"][number] | undefined;
  lieutenant: ReturnType<typeof useGameStore.getState>["lieutenants"][number] | undefined;
  captain: ReturnType<typeof useGameStore.getState>["captains"][number] | undefined;
}) {
  // Sem intendência (o começo humilde), o vivandeiro atende na tenda
  const noQuartermaster = useGameStore((s) => !has(s.campPlan, "QUARTERMASTER"));
  switch (panel.kind) {
    case "MISSIONS":
      return <MissionJournal />;
    case "TENT":
      return (
        <>
          <ContractBoard />
          <PlanButton />
          <CampNeedsPanel />
          <BookButton />
          <PrisonersPanel />
          <DiplomacyPanel />
          <CommandBoard />
          <LieutenantRoster />
          <FollowersPanel />
          <FaithPanel />
          <InfirmaryPanel />
          <BattalionList />
          {noQuartermaster && (
            <>
              <MarketPanel />
              <WagonPanel />
            </>
          )}
          <CampLog />
          <WorldChronicle />
        </>
      );
    case "QUARTERMASTER":
      return (
        <>
          <MarketPanel />
          <DepotPanel />
          <WagonPanel />
          <IronTrader />
        </>
      );
    case "RECRUIT":
      return (
        <>
          <RecruitPanel />
          <CaptainCandidates />
          <LieutenantCandidates />
        </>
      );
    case "TRAINING":
      return <TrainingPanel />;
    case "STABLE":
      return <StablePanel />;
    case "FORGE":
      return <ForgePanel />;
    case "BATTALION":
      return battalion ? (
        <>
          <BattalionDetail battalion={battalion} />
          <BattalionCommander battalionId={battalion.id} />
        </>
      ) : (
        <p className="text-sm text-neutral-400">Este batalhão não existe mais.</p>
      );
    case "LIEUTENANT":
      return lieutenant ? (
        <LieutenantSheet lieutenant={lieutenant} />
      ) : (
        <p className="text-sm text-neutral-400">Este tenente não está mais no bando.</p>
      );
    case "SUPPLY":
      return <SupplyPanel />;
    case "CAPTAIN":
      return captain ? <CaptainSheet captain={captain} /> : <p className="text-sm text-neutral-400">Este capitão não está no acampamento.</p>;
    case "TOWN":
      return <SettlementPanel settlementId={panel.settlementId} at={panel.at} />;
    case "GAME":
      return <GamePanel />;
    case "BRIDGE":
      return <BridgePanel bridgeId={panel.bridgeId} />;
    case "FERRY":
      return <FerryPanel ferryId={panel.ferryId} />;
    case "PEDDLER":
      return <PeddlerPanel />;
    case "GUILD":
    case "TEMPLE":
      return <GuildPanel settlementId={panel.settlementId} />;
    case "TAVERN":
      return (
        <>
          <TavernHire settlementId={panel.settlementId} />
          <GuildPanel settlementId={panel.settlementId} />
        </>
      );
    case "CAMP_BUILDING":
      return <CampBuildingContent buildingId={panel.buildingId} />;
    case "CAMP_PLAN":
      return <CampPlanPanel />;
    case "PRICE_BOOK":
      return <PriceBook />;
    case "DEPARTURE":
      return <DeparturePanel />;
    case "NOBILITY":
      return <NobilityBook />;
    case "DOCK":
      return <DockPanel settlementId={panel.settlementId} />;
    case "SAGA":
      return <SagaPanel />;
  }
}

/**
 * Interação com os lugares do mundo: aviso "E — ..." e o painel do local visitado
 * (tenda, intendência, recrutamento, alojamentos, tenentes, mercado de uma cidade...).
 * Com um painel aberto o mundo fica em pausa.
 */
export function PlacePanelView() {
  const panel = useGameStore((s) => s.campPanel);
  const prompt = useGameStore((s) => s.campPrompt);
  const setCampPanel = useGameStore((s) => s.setCampPanel);
  const subtitle = useGameStore((s) => {
    if (panel?.kind === "BATTALION") return s.battalions.find((b) => b.id === panel.battalionId)?.name;
    if (panel?.kind === "LIEUTENANT") {
      const l = s.lieutenants.find((x) => x.id === panel.lieutenantId);
      return l ? fullName(l) : undefined;
    }
    if (panel?.kind === "CAPTAIN") {
      const c = s.captains.find((x) => x.id === panel.captainId);
      return c ? captainName(c) : undefined;
    }
    if (panel?.kind === "CAMP_BUILDING") {
      const b = s.campPlan.buildings.find((x) => x.id === panel.buildingId);
      return b ? CAMP_BUILDINGS[b.kind].label : undefined;
    }
    if (panel?.kind === "TOWN" || panel?.kind === "DOCK" || panel?.kind === "GUILD" || panel?.kind === "TAVERN" || panel?.kind === "TEMPLE") return s.settlements.find((t) => t.id === panel.settlementId)?.name;
    return undefined;
  });
  const pendingMutiny = useGameStore((s) => s.pendingMutiny);
  const dialog = useGameStore((s) => s.dialog);

  return (
    <div className="pointer-events-none absolute inset-0 text-white">
      {pendingMutiny && (
        <div className="pointer-events-auto absolute left-1/2 top-24 w-[36rem] max-w-[90vw] -translate-x-1/2">
          <MutinyBanner />
        </div>
      )}

      {prompt && !panel && !dialog && (
        <div className="hud-box absolute bottom-40 left-1/2 -translate-x-1/2 px-4 py-1 font-mono text-sm text-amber-200">
          {prompt}
        </div>
      )}

      {panel && (
        <aside className="frame-wood pointer-events-auto absolute bottom-0 right-0 top-0 flex w-full max-w-lg flex-col shadow-2xl">
          <header className="flex items-center justify-between border-b border-neutral-700 px-4 py-3">
            <h2 className="text-lg font-bold">
              {PANEL_TITLE[panel.kind]}
              {subtitle && <span className="font-normal text-neutral-400"> · {subtitle}</span>}
            </h2>
            <button
              type="button"
              onClick={() => setCampPanel(null)}
              className="btn-pixel btn-wood px-1.5 py-0.5"
              aria-label="Fechar"
            >
              <PixelIcon id="CLOSE" />
            </button>
          </header>
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {!NO_STATUS.has(panel.kind) && <CampStatus />}
            <PanelContent panel={panel} />
          </div>
        </aside>
      )}
    </div>
  );
}
