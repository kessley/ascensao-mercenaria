import { useMemo, useState } from "react";
import { entriesAbout, type AnnalEntry, type LegendBook, type LegendSubject } from "../../game/sim/legends";
import { useGameStore } from "../../store/useGameStore";
import { Button } from "../components/Button";

type Tab = "CHRONICLE" | "PEOPLE" | "BATTLES" | "REALMS" | "TOWNS" | "BEFORE";

const TABS: { id: Tab; label: string }[] = [
  { id: "CHRONICLE", label: "Crônica" },
  { id: "PEOPLE", label: "Pessoas" },
  { id: "BATTLES", label: "Batalhas" },
  { id: "REALMS", label: "Reinos" },
  { id: "TOWNS", label: "Povoados" },
  { id: "BEFORE", label: "Antes do bando" },
];

const TONE = { info: "text-neutral-300", good: "text-emerald-300", bad: "text-red-300" };

function Entries({ list }: { list: readonly AnnalEntry[] }) {
  if (list.length === 0) return <p className="text-sm text-neutral-500">A crônica não diz nada sobre isso.</p>;
  return (
    <ol className="flex flex-col gap-1 text-sm">
      {[...list].reverse().map((e) => (
        <li key={e.id} className="flex gap-2">
          <span className="w-16 shrink-0 font-mono text-xs text-neutral-500">dia {e.day}</span>
          <span className={TONE[e.tone]}>{e.text}</span>
        </li>
      ))}
    </ol>
  );
}

function Subjects({ list, annals }: { list: readonly LegendSubject[]; annals: readonly AnnalEntry[] }) {
  const [open, setOpen] = useState<LegendSubject | null>(null);
  const about = useMemo(() => (open ? entriesAbout(annals, open.name) : []), [open, annals]);
  if (list.length === 0) return <p className="text-sm text-neutral-500">Ninguém entrou para a história ainda.</p>;
  return (
    <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[18rem_1fr]">
      <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto pr-1">
        {list.map((s) => (
          <li key={s.name}>
            <button type="button" onClick={() => setOpen(s)} className={`w-full rounded border px-2 py-1 text-left text-sm ${open?.name === s.name ? "border-amber-400 bg-amber-500/10" : "border-transparent hover:border-neutral-600"}`}>
              <span className="block text-neutral-100">{s.name}</span>
              <span className="block text-xs text-neutral-500">{s.role}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="min-h-0 overflow-y-auto">
        {open ? (
          <>
            <h3 className="font-serif text-xl text-amber-100">{open.name}</h3>
            <p className="mb-2 text-xs text-neutral-400">{open.role}</p>
            {open.note && <p className="mb-2 text-sm italic text-neutral-300">{open.note}</p>}
            <Entries list={about} />
          </>
        ) : (
          <p className="text-sm text-neutral-500">Escolha um nome para ler o que a crônica conta.</p>
        )}
      </div>
    </div>
  );
}

/** A crônica navegável de uma saga: em andamento ou já terminada. */
export function LegendBookView({ book, onClose }: { book: LegendBook; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("CHRONICLE");
  const [search, setSearch] = useState("");
  const found = useMemo(() => (search.trim() ? book.annals.filter((e) => e.text.toLowerCase().includes(search.trim().toLowerCase())) : book.annals), [book.annals, search]);
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex justify-center bg-black/90 text-white">
      <div className="flex h-full w-[68rem] max-w-full flex-col gap-3 p-5">
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-3xl text-amber-100">{book.title}</h2>
          <Button variant="quiet" onClick={onClose}>
            Fechar o livro
          </Button>
        </header>
        <nav className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`rounded border px-3 py-1 text-sm ${tab === t.id ? "border-amber-400 text-amber-200" : "border-neutral-700 text-neutral-300 hover:border-neutral-500"}`}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {tab === "CHRONICLE" && (
            <>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar na crônica" aria-label="Procurar na crônica" className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none focus:border-amber-400" />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Entries list={found} />
              </div>
            </>
          )}
          {tab === "PEOPLE" && <Subjects list={book.people} annals={book.annals} />}
          {tab === "REALMS" && <Subjects list={book.realms} annals={book.annals} />}
          {tab === "TOWNS" && <Subjects list={book.towns} annals={book.annals} />}
          {tab === "BATTLES" && (
            <ol className="flex min-h-0 flex-col gap-1 overflow-y-auto text-sm">
              {book.battles.length === 0 && <li className="text-neutral-500">Nenhuma batalha ainda.</li>}
              {[...book.battles].reverse().map((b, i) => (
                <li key={i} className="flex gap-2 rounded bg-neutral-900 px-2 py-1">
                  <span className="w-16 shrink-0 font-mono text-xs text-neutral-500">dia {b.day}</span>
                  <span className={`flex-1 ${b.won ? "text-emerald-300" : "text-red-300"}`}>{b.title}</span>
                  <span className="text-xs text-neutral-400">{b.casualties} baixa(s){b.lost.length > 0 ? ` · perdidos: ${b.lost.join(", ")}` : ""}</span>
                </li>
              ))}
            </ol>
          )}
          {tab === "BEFORE" && (
            <ol className="flex min-h-0 flex-col gap-1 overflow-y-auto text-sm">
              {book.before.map((h, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-20 shrink-0 font-mono text-xs text-neutral-500">ano {h.year}</span>
                  <span className="text-neutral-300">{h.text}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

/** As Lendas da campanha em andamento. */
export function LegendsOverlay() {
  const open = useGameStore((s) => s.legendsOpen);
  const close = useGameStore((s) => s.setLegendsOpen);
  const book = useMemo(() => (open ? useGameStore.getState().legendBook() : null), [open]);
  if (!book) return null;
  return <LegendBookView book={book} onClose={() => close(false)} />;
}

/** Alguém morreu, e o bando segue: a tela que para o jogo. */
export function SuccessionView() {
  const s = useGameStore((st) => st.succession);
  const close = useGameStore((st) => st.closeSuccession);
  const leader = useGameStore((st) => st.leader);
  if (!s) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/80 text-white">
      <div className="flex w-[30rem] max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-lg border border-neutral-600 bg-neutral-900 p-6">
        <h2 className="font-serif text-3xl text-amber-100">{s.dead} morreu</h2>
        <p className="text-sm text-neutral-300 first-letter:uppercase">{s.cause}.</p>
        <p className="text-sm text-neutral-100">
          {s.stranger ? `Sem tenentes para herdar, a tropa escolheu ${s.heir} entre os veteranos.` : `${s.heir}, ${s.origin}, ergueu o estandarte.`} O bando continua, com menos fama e de luto.
        </p>
        {leader.traits.length > 0 && <p className="text-xs text-neutral-400">{leader.generation}º Comandante do bando. O jeito de quem manda agora muda o rumo: veja o Livro do Bando (L).</p>}
        <Button variant="gold" onClick={close}>
          Seguir sob {s.heir}
        </Button>
      </div>
    </div>
  );
}

/** O fim da saga. */
export function EpilogueView() {
  const e = useGameStore((s) => s.epilogue);
  const open = useGameStore((s) => s.setLegendsOpen);
  const leave = useGameStore((s) => s.leaveScenario);
  if (!e) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/90 text-white">
      <div className="flex max-h-[90vh] w-[38rem] max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto p-6">
        <h2 className="font-serif text-4xl text-amber-100">Epílogo</h2>
        {e.lines.map((line, i) => (
          <p key={i} className="font-serif text-lg text-neutral-200">
            {line}
          </p>
        ))}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="gold" onClick={() => open(true)}>
            Ler as Lendas
          </Button>
          <Button variant="quiet" onClick={() => leave(null)}>
            Menu principal
          </Button>
        </div>
      </div>
    </div>
  );
}
