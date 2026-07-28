import { useEffect, useState } from 'react';
import {
  AlertTriangle, Check, ClipboardPaste, Copy, Crown, Layers, Link2, Trash2, X,
} from 'lucide-react';
import { useDecks, type FetchedImport } from '../../store/deckStore';
import { Card } from '../card/Card';
import { ManaCost } from '../card/ManaCost';
import { exposeDevHandles } from '../../devHandles';
import type { ValidationIssue } from '../../data/deckTypes';

// Decks: the list, and the import flow — a link or a paste.
//
// The import panel shows what WILL happen before anything is saved: every parsed
// line, every unresolved name with suggestions, and the full validation verdict.
// Nothing is silently dropped or silently fixed. A downloaded list lands in the
// same box a pasted one does, so what you are about to import is on screen and
// editable either way.

export function DecksScreen() {
  const {
    decks, loading, preview, previewing, fetching, error,
    refresh, buildPreview, importFromUrl, clearPreview, savePreview, remove, duplicate,
  } = useDecks();

  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [fetched, setFetched] = useState<FetchedImport | null>(null);
  const [deckName, setDeckName] = useState('');
  const [promoteFirst, setPromoteFirst] = useState(true);
  const [importing, setImporting] = useState(false);

  const closeImport = () => {
    setImporting(false);
    clearPreview();
    setText('');
    setUrl('');
    setFetched(null);
    setDeckName('');
  };

  const fetchFromUrl = async () => {
    const result = await importFromUrl(url.trim(), promoteFirst);
    setFetched(result);
    if (result) setText(result.text);
  };

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { exposeDevHandles({ decks: useDecks }); }, []);

  const noCommanderHeader = preview !== null && !preview.parsed.hadSections;

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex items-start gap-3">
          <Layers size={22} className="mt-1 text-crt-accent" aria-hidden />
          <div className="flex-1">
            <h2 className="font-display text-lg">Decks</h2>
            <p className="mt-1 text-sm text-crt-dim">
              Import a deck by its Moxfield, Archidekt or TappedOut link, or paste a
              decklist from anywhere. Set codes, categories and foil markers are all
              understood.
            </p>
          </div>
          {!importing && (
            <button
              type="button"
              onClick={() => setImporting(true)}
              className="inline-flex items-center gap-1.5 rounded border border-crt-accent-lo bg-crt-accent px-3 py-1.5 text-sm text-crt-on-accent hover:bg-crt-accent-hi"
            >
              <ClipboardPaste size={15} aria-hidden />
              Import a deck
            </button>
          )}
        </header>

        {/* ── import ── */}
        {importing && (
          <section className="flex flex-col gap-3 rounded-lg border border-crt-border bg-crt-surface p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-sc text-xs tracking-wider text-crt-dim">Import a deck</h3>
              <button
                type="button"
                onClick={closeImport}
                className="text-crt-faint hover:text-crt-text"
                aria-label="Close import"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            {/* ── from a link ── */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && url.trim().length > 0 && !fetching) void fetchFromUrl();
                }}
                spellCheck={false}
                placeholder="https://www.moxfield.com/decks/your-deck-id"
                aria-label="Deck link"
                data-import="url"
                className="min-w-64 flex-1 rounded border border-crt-border bg-crt-inset px-2.5 py-1.5 font-mono text-[12.5px] outline-none focus:border-crt-accent"
              />
              <button
                type="button"
                disabled={url.trim().length === 0 || fetching}
                onClick={() => void fetchFromUrl()}
                data-import="fetch"
                className="inline-flex items-center gap-1.5 rounded border border-crt-border-hi bg-crt-raised px-3 py-1.5 text-sm hover:border-crt-accent disabled:opacity-40"
              >
                <Link2 size={15} aria-hidden />
                {fetching ? 'Downloading…' : 'Fetch decklist'}
              </button>
            </div>
            <p className="-mt-1 text-xs text-crt-faint" data-import="sites">
              Moxfield, Archidekt and TappedOut links all work. This is the one thing in
              the app that needs the internet during play — the deck itself is kept on
              your own machine.
            </p>

            {fetched && (
              <p className="rounded border border-crt-border bg-crt-inset px-2.5 py-2 text-xs text-crt-dim" data-import="fetched">
                Downloaded{' '}
                <span className="text-crt-text">{fetched.name || 'this deck'}</span>
                {' — check it below, then save it.'}
                {!fetched.commanderKnown && (
                  <> The list did not say which card is the commander: add a{' '}
                    <span className="font-mono">Commander</span> heading above it, or tick
                    the box below to use the first card.
                  </>
                )}
              </p>
            )}

            <h3 className="font-sc text-xs tracking-wider text-crt-dim">
              {fetched ? 'The decklist' : 'Or paste a decklist'}
            </h3>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              spellCheck={false}
              placeholder={'Commander\n1 Kess, Dissident Mage\n\nDeck\n1 Sol Ring (ltc) 264\n1 Lightning Bolt\n…'}
              className="w-full resize-y rounded border border-crt-border bg-crt-inset p-3 font-mono text-[12.5px] leading-relaxed outline-none focus:border-crt-accent"
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={text.trim().length === 0 || previewing}
                onClick={() => void buildPreview(text, promoteFirst)}
                className="rounded border border-crt-border-hi bg-crt-raised px-3 py-1.5 text-sm hover:border-crt-accent disabled:opacity-40"
              >
                {previewing ? 'Checking…' : 'Check this list'}
              </button>
              <label className="flex items-center gap-2 text-xs text-crt-dim">
                <input
                  type="checkbox"
                  checked={promoteFirst}
                  onChange={(e) => setPromoteFirst(e.target.checked)}
                  data-import="detect-commander"
                />
                If there is no Commander heading, work out the commander from the cards
              </label>
            </div>

            {error && (
              <p className="rounded border border-crt-danger/40 bg-crt-danger/10 p-2.5 text-sm text-crt-danger">
                {error}
              </p>
            )}

            {preview && (
              <div className="flex flex-col gap-4 border-t border-crt-border pt-4">
                {/* verdict */}
                <div className="flex flex-wrap items-center gap-3">
                  {preview.report.ok ? (
                    <span className="flex items-center gap-1.5 text-sm text-crt-ok">
                      <Check size={16} aria-hidden />
                      Legal Commander deck
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm text-crt-danger">
                      <AlertTriangle size={16} aria-hidden />
                      {preview.report.issues.filter((i) => i.severity === 'error').length} problem(s)
                    </span>
                  )}
                  <span className="crt-num text-xs text-crt-faint">
                    {preview.report.counts.total} cards · {preview.report.counts.unique} unique
                  </span>
                  {preview.report.colorIdentity.length > 0 && (
                    <ManaCost
                      cost={preview.report.colorIdentity.map((c) => `{${c}}`).join('')}
                      size={13}
                    />
                  )}
                </div>

                {/* A commander nobody typed has to be said out loud. */}
                {preview.detected && (
                  <p className="rounded border border-crt-border bg-crt-inset px-2.5 py-2 text-xs text-crt-dim"
                    data-import="detected">
                    {preview.detected}
                  </p>
                )}

                {noCommanderHeader && preview.commanders.length === 0 && (
                  <p className="text-xs text-crt-warn">
                    This list has no Commander heading, and no card in it can be a
                    commander. Add a “Commander” heading above the card you want.
                  </p>
                )}

                {/* commanders, with art */}
                {preview.commanders.some((r) => r.card) && (
                  <div className="flex flex-wrap items-start gap-3">
                    {preview.commanders.map((r) =>
                      r.card ? (
                        <div key={r.entry.lineNo} className="flex items-center gap-2">
                          <Crown size={14} className="text-crt-accent" aria-hidden />
                          <Card card={r.card} height={148} />
                        </div>
                      ) : null,
                    )}
                  </div>
                )}

                {/* issues */}
                {preview.report.issues.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {preview.report.issues.map((issue, i) => (
                      <IssueRow key={i} issue={issue} />
                    ))}
                  </ul>
                )}

                {/* lines we could not read at all */}
                {preview.parsed.problems.length > 0 && (
                  <div className="rounded border border-crt-warn/40 bg-crt-warn/10 p-2.5">
                    <p className="mb-1 text-xs text-crt-warn">
                      These lines were not understood and have been left out:
                    </p>
                    <ul className="crt-num flex flex-col gap-0.5 text-xs text-crt-dim">
                      {preview.parsed.problems.map((p) => (
                        <li key={p.lineNo}>line {p.lineNo}: {p.raw}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <input
                    value={deckName}
                    onChange={(e) => setDeckName(e.target.value)}
                    placeholder={fetched?.name || preview.commanders[0]?.card?.name || 'Deck name'}
                    className="w-64 rounded border border-crt-border bg-crt-inset px-2.5 py-1.5 text-sm outline-none focus:border-crt-accent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const name = deckName.trim()
                        || fetched?.name
                        || preview.commanders[0]?.card?.name
                        || 'Untitled deck';
                      void savePreview(name).then(closeImport);
                    }}
                    className="rounded border border-crt-accent-lo bg-crt-accent px-3 py-1.5 text-sm text-crt-on-accent hover:bg-crt-accent-hi"
                  >
                    Save deck
                  </button>
                  {/* Saving an illegal deck is allowed — you may be mid-build. */}
                  {!preview.report.ok && (
                    <span className="text-xs text-crt-faint">
                      You can save it and fix the problems later.
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── list ── */}
        <section className="flex flex-col gap-2">
          {loading && decks.length === 0 && (
            <p className="text-sm text-crt-faint">Loading…</p>
          )}
          {!loading && decks.length === 0 && !importing && (
            <p className="rounded-lg border border-dashed border-crt-border p-6 text-center text-sm text-crt-faint">
              No decks yet. Import one to get started.
            </p>
          )}
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="flex items-center gap-3 rounded-lg border border-crt-border bg-crt-surface px-4 py-3"
            >
              <div className="flex-1">
                <div className="font-display text-[15px]">{deck.name}</div>
                <div className="text-xs text-crt-faint">
                  {deck.commanderNames.length > 0
                    ? deck.commanderNames.join(' + ')
                    : 'No commander set'}
                  {' · '}
                  <span className="crt-num">{deck.cardCount}</span> cards
                  {deck.houseRuled ? ' · house-ruled' : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void duplicate(deck.id)}
                title="Duplicate"
                className="text-crt-faint hover:text-crt-text"
              >
                <Copy size={15} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => void remove(deck.id)}
                title="Delete (moved to a trash folder)"
                className="text-crt-faint hover:text-crt-danger"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const isError = issue.severity === 'error';
  return (
    <li
      className={`flex items-start gap-2 rounded border px-2.5 py-1.5 text-xs ${
        isError
          ? 'border-crt-danger/40 bg-crt-danger/10 text-crt-danger'
          : 'border-crt-warn/40 bg-crt-warn/10 text-crt-warn'
      }`}
      data-issue-code={issue.code}
      data-issue-severity={issue.severity}
    >
      <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
      <span className="text-crt-text/90">
        {issue.lineNo ? <span className="crt-num text-crt-faint">line {issue.lineNo}: </span> : null}
        {issue.message}
      </span>
    </li>
  );
}
