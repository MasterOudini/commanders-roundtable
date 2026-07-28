import { useEffect } from 'react';
import { Database, Download, X, RotateCw, AlertTriangle, Check, Image as ImageIcon } from 'lucide-react';
import { formatBytes, useCardDb, STALE_AFTER_DAYS } from '../../store/cardDbStore';
import { exposeDevHandles } from '../../devHandles';

// Card database screen. Every card's name, cost, type, oracle text, keywords and
// legality comes from one Scryfall bulk file downloaded here.
//
// Copy rule for this screen: say what will happen, in real numbers, before the
// user commits to it. "Download card database" with no size is the kind of button
// people are right to distrust.

export function CardDatabaseScreen() {
  const { status, progress, images, syncing, error, unavailable, refresh, sync, cancel, restartWorker, listen } =
    useCardDb();

  useEffect(() => {
    void refresh();
    return listen();
  }, [refresh, listen]);

  useEffect(() => {
    exposeDevHandles({ cardDb: useCardDb });
  }, []);

  const stale = (status?.ageDays ?? 0) > STALE_AFTER_DAYS;
  const hasData = status?.state === 'ready' || status?.state === 'downloaded';
  const workerBroken = status?.worker === 'crashed';

  const pct =
    progress?.total && progress.received !== undefined
      ? Math.min(100, Math.floor((progress.received / progress.total) * 100))
      : null;

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex items-start gap-3">
          <Database size={22} className="mt-1 text-crt-accent" aria-hidden />
          <div>
            <h2 className="font-display text-lg">Card database</h2>
            <p className="mt-1 text-sm text-crt-dim">
              Card names, costs, types, rules text and Commander legality come from
              Scryfall&apos;s public bulk data. It downloads once and then everything
              works offline — games never wait on the network.
            </p>
          </div>
        </header>

        {unavailable && (
          <p className="rounded border border-crt-warn/40 bg-crt-warn/10 p-3 text-sm text-crt-warn">
            The desktop bridge is not available in a browser tab, so the card
            database cannot be managed here.
          </p>
        )}

        <section className="rounded-lg border border-crt-border bg-crt-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-sc text-xs tracking-wider text-crt-faint">Status</span>
              {status?.state === 'ready' && (
                <span className="flex items-center gap-1.5 text-sm text-crt-ok">
                  <Check size={15} aria-hidden />
                  Ready — {status.cardCount?.toLocaleString()} cards
                </span>
              )}
              {status?.state === 'downloaded' && (
                <span className="text-sm text-crt-warn">
                  Downloaded, not yet indexed
                </span>
              )}
              {status?.state === 'absent' && (
                <span className="text-sm text-crt-dim">
                  Not downloaded yet
                </span>
              )}
              {status?.state === 'unknown' && (
                <span className="text-sm text-crt-warn">Unavailable</span>
              )}
            </div>

            <div className="flex gap-2">
              {syncing ? (
                <button
                  type="button"
                  onClick={() => void cancel()}
                  className="inline-flex items-center gap-1.5 rounded border border-crt-border-hi bg-crt-raised px-3 py-1.5 text-sm hover:border-crt-danger hover:text-crt-danger"
                >
                  <X size={15} aria-hidden />
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  disabled={unavailable}
                  onClick={() => void sync()}
                  className="inline-flex items-center gap-1.5 rounded border border-crt-accent-lo bg-crt-accent px-3 py-1.5 text-sm text-crt-on-accent transition-colors hover:bg-crt-accent-hi disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download size={15} aria-hidden />
                  {hasData ? 'Update card database' : 'Download card database'}
                </button>
              )}
            </div>
          </div>

          {/* Set expectations before the click, not after. */}
          {!hasData && !syncing && (
            <p className="mt-3 text-xs text-crt-faint">
              About 73 MB to download, once. It resumes if the connection drops.
            </p>
          )}

          {syncing && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-baseline justify-between text-xs text-crt-dim">
                <span>{phaseLabel(progress?.phase, progress?.message)}</span>
                {pct !== null && <span className="crt-num">{pct}%</span>}
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-crt-inset"
                role="progressbar"
                aria-valuenow={pct ?? undefined}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-crt-accent transition-[width] duration-200 ease-out"
                  style={{ width: pct !== null ? `${pct}%` : '35%' }}
                />
              </div>
              {progress?.received !== undefined && progress.total ? (
                <span className="crt-num text-xs text-crt-faint">
                  {formatBytes(progress.received)} of {formatBytes(progress.total)}
                  {progress.resumedFrom
                    ? ` · resumed from ${formatBytes(progress.resumedFrom)}`
                    : ''}
                </span>
              ) : null}
            </div>
          )}

          {error && (
            <p className="mt-4 flex items-start gap-2 rounded border border-crt-danger/40 bg-crt-danger/10 p-2.5 text-sm text-crt-danger">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                {error}
                <br />
                <span className="text-crt-dim">
                  Your existing card data is untouched. Try again when you have a
                  connection — a partly finished download picks up where it stopped.
                </span>
              </span>
            </p>
          )}
        </section>

        {hasData && (
          <section className="rounded-lg border border-crt-border bg-crt-surface p-5">
            <h3 className="font-sc mb-3 text-xs tracking-wider text-crt-faint">Details</h3>
            <dl className="grid grid-cols-[11rem_1fr] gap-y-1.5 text-sm">
              <dt className="text-crt-faint">Scryfall release</dt>
              <dd className="crt-num">{status?.updatedAt?.slice(0, 10)}</dd>
              <dt className="text-crt-faint">Printings</dt>
              <dd className="crt-num">{status?.bulkLines?.toLocaleString()}</dd>
              <dt className="text-crt-faint">Downloaded size</dt>
              <dd className="crt-num">
                {status?.bulkBytes ? formatBytes(status.bulkBytes) : '—'}
              </dd>
              <dt className="text-crt-faint">Age</dt>
              <dd className={stale ? 'text-crt-warn' : ''}>
                {status?.ageDays === 0 ? 'Today' : `${status?.ageDays} days`}
              </dd>
            </dl>

            {stale && (
              <p className="mt-3 flex items-start gap-2 text-xs text-crt-warn">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                This data is more than {STALE_AFTER_DAYS} days old. The Commander ban
                list and any new cards come from it, so update before a game if you
                can.
              </p>
            )}
          </section>
        )}

        {images && (
          <section className="rounded-lg border border-crt-border bg-crt-surface p-5">
            <h3 className="font-sc mb-3 flex items-center gap-2 text-xs tracking-wider text-crt-faint">
              <ImageIcon size={13} aria-hidden />
              Card art
            </h3>
            <p className="mb-3 text-sm text-crt-dim">
              Art downloads for the decks you import and is kept forever. Low-detail
              crops arrive first so cards are recognisable within seconds, then the
              full-resolution scans replace them.
            </p>
            <dl className="grid grid-cols-[11rem_1fr] gap-y-1.5 text-sm">
              <dt className="text-crt-faint">Images cached</dt>
              <dd className="crt-num">
                {images.cache.files.toLocaleString()} · {formatBytes(images.cache.bytes)}
              </dd>
              {images.pending > 0 && (
                <>
                  <dt className="text-crt-faint">Downloading</dt>
                  <dd className="crt-num text-crt-accent-hi">
                    {images.pending.toLocaleString()} queued
                    {images.running ? '' : ' (paused)'}
                  </dd>
                </>
              )}
              {images.dead > 0 && (
                <>
                  <dt className="text-crt-faint">Unavailable</dt>
                  <dd className="crt-num">{images.dead.toLocaleString()}</dd>
                </>
              )}
            </dl>

            {images.pending > 0 && (
              <button
                type="button"
                onClick={() => void window.crt?.images.cancel()}
                className="mt-3 inline-flex items-center gap-1.5 rounded border border-crt-border-hi px-2.5 py-1 text-xs text-crt-dim hover:border-crt-danger hover:text-crt-danger"
              >
                <X size={13} aria-hidden />
                Stop downloading art
              </button>
            )}

            {images.dead > 0 && (
              <p className="mt-3 text-xs text-crt-faint">
                {images.dead === 1 ? 'One image' : `${images.dead} images`} could not be
                found on Scryfall. Those cards still play normally — they show a
                typeset face instead of art.
              </p>
            )}
          </section>
        )}

        {workerBroken && (
          <section className="rounded-lg border border-crt-danger/40 bg-crt-danger/10 p-4">
            <p className="flex items-center justify-between gap-3 text-sm text-crt-danger">
              <span>The card database process stopped unexpectedly.</span>
              <button
                type="button"
                onClick={() => void restartWorker()}
                className="inline-flex items-center gap-1.5 rounded border border-crt-danger/60 px-2.5 py-1 hover:bg-crt-danger/20"
              >
                <RotateCw size={14} aria-hidden />
                Restart it
              </button>
            </p>
          </section>
        )}

        <p className="text-xs text-crt-faint">
          Card data and images are from Scryfall. Card images are downloaded by your
          own copy of the app and are never bundled with it. Magic: The Gathering is
          © Wizards of the Coast; this is an unofficial personal project.
        </p>
      </div>
    </div>
  );
}

function phaseLabel(phase: string | undefined, message: string | undefined): string {
  if (message) return message;
  switch (phase) {
    case 'manifest': return 'Checking for the latest card data…';
    case 'download': return 'Downloading card data…';
    case 'verify': return 'Checking the download…';
    case 'transform': return 'Building the card index…';
    default: return 'Working…';
  }
}
