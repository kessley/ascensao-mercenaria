import { useGameStore, type CampPanel } from "../../store/useGameStore";
import { fullName, PASSIVES } from "../../game/data/lieutenants";
import { BattalionList, RecruitPanel } from "../components/tent/ArmyPanel";
import { BattalionDetail, ForgePanel, IronTrader, TrainingPanel } from "../components/tent/ProgressionPanels";
import { LieutenantCandidates, LieutenantRoster, LieutenantSheet } from "../components/tent/LieutenantPanels";
import { CampLog } from "../components/tent/CampLog";
import { CampStatus } from "../components/tent/CampStatus";
import { ContractBoard } from "../components/tent/ContractBoard";
import { MarketPanel } from "../components/tent/MarketPanel";
import { MutinyBanner } from "../components/tent/MutinyBanner";
import { StablePanel } from "../components/tent/StablePanel";
import { SettlementPanel } from "../components/SettlementPanel";
import { DiplomacyPanel, WorldChronicle } from "../components/tent/RealmPanels";
import { GamePanel } from "../components/SavePanel";

const PANEL_TITLE: Record<CampPanel["kind"], string> = {
  TENT: "Tenda do Comandante",
  QUARTERMASTER: "Intendência",
  RECRUIT: "Posto de Recrutamento",
  TRAINING: "Campo de Treino",
  FORGE: "Ferraria",
  BATTALION: "Alojamento",
  LIEUTENANT: "Tenente",
  STABLE: "Estábulo",
  TOWN: "Povoado",
  GAME: "Jogo",
};

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
          <span className="text-xs text-sky-300">★ {PASSIVES[lieutenant.passive].label}</span>
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

  switch (panel.kind) {
    case "TENT":
      return (
        <>
          <ContractBoard />
          <DiplomacyPanel />
          <LieutenantRoster />
          <BattalionList />
          <CampLog />
          <WorldChronicle />
        </>
      );
    case "QUARTERMASTER":
      return (
        <>
          <MarketPanel />
          <IronTrader />
        </>
      );
    case "RECRUIT":
      return (
        <>
          <RecruitPanel />
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
    case "TOWN":
      return <SettlementPanel settlementId={panel.settlementId} />;
    case "GAME":
      return <GamePanel />;
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
    if (panel?.kind === "TOWN") return s.settlements.find((t) => t.id === panel.settlementId)?.name;
    return undefined;
  });
  const pendingMutiny = useGameStore((s) => s.pendingMutiny);

  return (
    <div className="pointer-events-none absolute inset-0 text-white">
      {pendingMutiny && (
        <div className="pointer-events-auto absolute left-1/2 top-24 w-[36rem] max-w-[90vw] -translate-x-1/2">
          <MutinyBanner />
        </div>
      )}

      {prompt && !panel && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 rounded-full border border-amber-300/60 bg-black/75 px-5 py-2 font-mono text-sm text-amber-200">
          {prompt}
        </div>
      )}

      {panel && (
        <aside className="pointer-events-auto absolute bottom-0 right-0 top-0 flex w-full max-w-lg flex-col border-l border-neutral-700 bg-neutral-900/95 shadow-2xl">
          <header className="flex items-center justify-between border-b border-neutral-700 px-4 py-3">
            <h2 className="text-lg font-bold">
              {PANEL_TITLE[panel.kind]}
              {subtitle && <span className="font-normal text-neutral-400"> · {subtitle}</span>}
            </h2>
            <button
              type="button"
              onClick={() => setCampPanel(null)}
              className="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-700 hover:text-white"
              aria-label="Fechar"
            >
              ✕
            </button>
          </header>
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {panel.kind !== "TOWN" && panel.kind !== "GAME" && <CampStatus />}
            <PanelContent panel={panel} />
          </div>
        </aside>
      )}
    </div>
  );
}
