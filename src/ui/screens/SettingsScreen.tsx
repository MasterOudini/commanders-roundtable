import { useEffect, useState, useSyncExternalStore } from 'react';
import { FolderOpen, Radio, RotateCw, ShieldCheck, Sparkles, Trash2, User } from 'lucide-react';
import { useSettings } from '../../store/settingsStore';
import { prefersReducedMotion, subscribeReducedMotion } from '../anim/reducedMotion';
import type { AppInfo, UpdaterStatus } from '../../types/bridge';

// Every user-visible setting, in one place. The store and the schema existed
// from M1 (`electron/settings.cjs` is the authority; this screen writes through
// the bridge and keeps the optimistic value), but until M5 the only way to reach
// most of them was to edit settings.json by hand.
//
// Copy rule on this screen: say what the setting DOES, not what it is called.
// "Animation speed: Fast" tells you nothing you could not read off the control;
// "the table stops flying cards and shows where they went" tells you what you
// are choosing. Every explanatory line below is there because the alternative is
// a user guessing.
//
// ⚠️ Two settings can be OVERRIDDEN by something outside this screen, and both
// say so rather than appearing to be ignored:
//   • animation speed, by the OS's "reduce motion" preference — see
//     `reducedMotion.ts` and D16;
//   • the relay address, by the per-origin `connect-src` allowlist, which only
//     takes effect on the NEXT document load (D48). A relay that is saved but
//     not yet reloaded would otherwise fail with "the host never answered".

const CARD = 'rounded-lg border border-crt-border bg-crt-surface p-5';
const HEAD = 'font-sc mb-3 flex items-center gap-2 text-sm tracking-wider text-crt-dim';
const INPUT =
  'rounded border border-crt-border bg-crt-inset px-2.5 py-1.5 text-sm text-crt-text outline-none ' +
  'focus:border-crt-accent';
const BTN =
  'inline-flex items-center gap-2 rounded border border-crt-border-hi bg-crt-raised px-3 py-1.5 text-sm ' +
  'transition-colors hover:border-crt-accent hover:text-crt-accent-hi disabled:cursor-not-allowed ' +
  'disabled:opacity-40';
const NOTE = 'mt-1.5 text-xs leading-relaxed text-crt-faint';

/** A labelled row: control on the left, explanation underneath. */
function Row(props: { label: string; htmlFor?: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-crt-dim" htmlFor={props.htmlFor}>
        {props.label}
      </label>
      {props.children}
      {props.note && <p className={NOTE}>{props.note}</p>}
    </div>
  );
}

export function SettingsScreen() {
  const { settings, hydrated, ephemeral, update } = useSettings();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [updater, setUpdater] = useState<UpdaterStatus | null>(null);
  const [relayDraft, setRelayDraft] = useState<string | null>(null);
  const [relayMessage, setRelayMessage] = useState<string | null>(null);
  const [relayNeedsReload, setRelayNeedsReload] = useState(false);
  const [origins, setOrigins] = useState<string[]>([]);
  // Live, so toggling the OS preference with this screen open updates it rather
  // than showing a value that was true when the screen mounted.
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);

  useEffect(() => {
    const bridge = window.crt;
    if (!bridge) return;
    void bridge.app.info().then(setInfo);
    void bridge.updater.status().then(setUpdater);
    void bridge.net.allowedOrigins().then(setOrigins);
    return bridge.updater.onStatus(setUpdater);
  }, []);

  // The draft is null until the user types, so an external settings change (or
  // the initial hydrate) is never overwritten by a stale controlled value.
  const relayValue = relayDraft ?? settings.relayUrl;

  const saveRelay = async (): Promise<void> => {
    const url = relayValue.trim();
    await update({ relayUrl: url });
    setRelayDraft(null);
    if (url === '') {
      setRelayMessage('Relay address cleared. You can still host and join on your own network.');
      setRelayNeedsReload(false);
      return;
    }
    const bridge = window.crt;
    if (!bridge) {
      setRelayMessage('Saved, but a browser tab cannot open game sockets — run the desktop app to play.');
      return;
    }
    const result = await bridge.net.allowOrigin(url);
    setRelayNeedsReload(result.added);
    setRelayMessage(
      result.ok
        ? result.added
          ? `Saved ${result.origin}. Reload the app once so it is allowed to open a socket there.`
          : `Saved ${result.origin}. It was already allowed, so you can host or join now.`
        : result.message,
    );
    setOrigins(await bridge.net.allowedOrigins());
  };

  return (
    <div className="flex-1 overflow-auto p-8" data-screen="settings">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header>
          <h2 className="font-display text-lg">Settings</h2>
          <p className="mt-1 text-sm text-crt-dim">
            Everything here is saved to <code className="crt-num text-xs">settings.json</code> in your
            files folder, and takes effect immediately unless a line below says otherwise.
          </p>
        </header>

        {ephemeral && (
          <p className="rounded border border-crt-warn/40 bg-crt-warn/10 p-3 text-sm text-crt-warn">
            You are running in a browser tab, so nothing on this screen will be saved. Launch the
            desktop app to change settings.
          </p>
        )}

        {!hydrated ? (
          <p className="text-sm text-crt-faint">Loading your settings…</p>
        ) : (
          <>
            <section className={CARD}>
              <h3 className={HEAD}>
                <User size={14} aria-hidden /> You
              </h3>
              <Row
                label="Your name at the table"
                htmlFor="set-name"
                note="This is what the other players see in the lobby and on your seat."
              >
                <input
                  id="set-name"
                  className={`${INPUT} w-64`}
                  value={settings.playerName}
                  maxLength={40}
                  onChange={(e) => void update({ playerName: e.target.value })}
                  data-setting="playerName"
                />
              </Row>
            </section>

            <section className={CARD}>
              <h3 className={HEAD}>
                <Sparkles size={14} aria-hidden /> Playing
              </h3>
              <div className="flex flex-col gap-5">
                <Row
                  label="Animation speed"
                  htmlFor="set-speed"
                  note={
                    'Cinematic plays every card flight in full. Off commits each change instantly and ' +
                    'flashes where things went — the game log still carries the full story, so nothing ' +
                    'is lost either way.'
                  }
                >
                  <select
                    id="set-speed"
                    className={`${INPUT} w-64`}
                    value={settings.animationSpeed}
                    onChange={(e) =>
                      void update({ animationSpeed: e.target.value as typeof settings.animationSpeed })
                    }
                    data-setting="animationSpeed"
                  >
                    <option value="cinematic">Cinematic — full speed</option>
                    <option value="brisk">Brisk — a little quicker</option>
                    <option value="fast">Fast — twice as quick</option>
                    <option value="off">Off — instant, no card flights</option>
                  </select>
                </Row>

                {/* ⚠️ The OS preference WINS. Saying so is the difference between
                    "this setting is broken" and "your computer asked for this". */}
                {reduced && (
                  <p
                    className="rounded border border-crt-accent/40 bg-crt-accent/10 p-3 text-xs text-crt-accent-hi"
                    data-setting-note="reducedMotion"
                  >
                    Windows is set to reduce motion, so the table is already running without card
                    flights whatever you pick here. The game itself is unaffected — every change still
                    happens, and the log still records it. Turn off &ldquo;Show animations in
                    Windows&rdquo; in Settings &rarr; Accessibility &rarr; Visual effects to change it.
                  </p>
                )}

                <Row
                  label="Mana payment"
                  htmlFor="set-autotap"
                  note={
                    'On, the app works out which lands to tap and shows you the payment to approve. ' +
                    'Off, you tap every source yourself.'
                  }
                >
                  <select
                    id="set-autotap"
                    className={`${INPUT} w-64`}
                    value={settings.autoTapMana ? 'auto' : 'manual'}
                    onChange={(e) => void update({ autoTapMana: e.target.value === 'auto' })}
                    data-setting="autoTapMana"
                  >
                    <option value="auto">Suggest a payment, I approve it</option>
                    <option value="manual">I tap my own lands</option>
                  </select>
                </Row>
              </div>
            </section>

            <section className={CARD}>
              <h3 className={HEAD}>
                <Radio size={14} aria-hidden /> Playing with friends
              </h3>
              <Row
                label="Relay address"
                htmlFor="set-relay"
                note={
                  'Only needed to play with someone who is not on your network. Leave it empty and you ' +
                  'can still host on your own network, or over Tailscale or a VPN. It must start with ' +
                  'wss:// — an unencrypted ws:// address is only accepted on your own network.'
                }
              >
                <div className="flex gap-2">
                  <input
                    id="set-relay"
                    className={`${INPUT} w-96 font-mono text-xs`}
                    placeholder="wss://relay.example.com"
                    value={relayValue}
                    onChange={(e) => setRelayDraft(e.target.value)}
                    data-setting="relayUrl"
                  />
                  <button type="button" className={BTN} onClick={() => void saveRelay()} data-setting-action="save-relay">
                    Save
                  </button>
                </div>
              </Row>

              {relayMessage && (
                <p className="mt-3 text-xs text-crt-warn" data-setting-message="relay">
                  {relayMessage}{' '}
                  {relayNeedsReload && (
                    <button
                      type="button"
                      className="underline decoration-dotted underline-offset-2 hover:text-crt-accent-hi"
                      onClick={() => void window.crt?.net.reload()}
                      data-setting-action="reload"
                    >
                      Reload now
                    </button>
                  )}
                </p>
              )}

              {/* ⚠️ D48. This list IS the security boundary — it is the entire set
                  of addresses the app may open a socket to. Showing it is not a
                  debug affordance: a user who does not know what their app can
                  reach cannot audit it, and it is the one thing here that a
                  compromised page would want to grow. */}
              <div className="mt-5">
                <p className="flex items-center gap-2 text-sm text-crt-dim">
                  <ShieldCheck size={14} aria-hidden />
                  Addresses this app is allowed to connect to
                </p>
                <ul className="mt-2 flex flex-col gap-1 font-mono text-xs text-crt-faint">
                  {origins.map((o) => (
                    <li key={o} data-origin={o}>
                      {o}
                    </li>
                  ))}
                </ul>
                <p className={NOTE}>
                  Game traffic can go to these and nowhere else. Your own network address is always
                  here; a relay is added when you save it above. Everything else the app downloads —
                  card data and card pictures — is fetched by the app itself, from Scryfall only, and
                  never by this page.
                </p>
              </div>
            </section>

            <section className={CARD}>
              <h3 className={HEAD}>Card pictures</h3>
              <div className="flex flex-col gap-5">
                <Row
                  label="Picture quality"
                  htmlFor="set-tier"
                  note={
                    'Best is the largest picture Scryfall publishes (745×1040) and is the default. ' +
                    'Smaller is a 672×936 JPEG at roughly a sixth of the size — pick it only if you are ' +
                    'genuinely short of disk space.'
                  }
                >
                  <select
                    id="set-tier"
                    className={`${INPUT} w-64`}
                    value={settings.imageTier}
                    onChange={(e) => void update({ imageTier: e.target.value as typeof settings.imageTier })}
                    data-setting="imageTier"
                  >
                    <option value="png">Best — 745×1040</option>
                    <option value="large">Smaller — 672×936</option>
                  </select>
                </Row>

                <Row
                  label="When you import a deck"
                  htmlFor="set-prefetch"
                  note={
                    'Downloading the pictures up front means a game never waits on the network. ' +
                    'A 100-card deck is roughly 90 MB and takes a few minutes in the background.'
                  }
                >
                  <select
                    id="set-prefetch"
                    className={`${INPUT} w-64`}
                    value={settings.prefetchArtOnImport ? 'yes' : 'no'}
                    onChange={(e) => void update({ prefetchArtOnImport: e.target.value === 'yes' })}
                    data-setting="prefetchArtOnImport"
                  >
                    <option value="yes">Download its pictures now</option>
                    <option value="no">Download them as I see the cards</option>
                  </select>
                </Row>
              </div>
            </section>

            {info && (
              <section className={CARD}>
                <h3 className={HEAD}>
                  <FolderOpen size={14} aria-hidden /> Your files
                </h3>
                <p className="crt-num break-all text-xs text-crt-dim" data-setting="dataRoot">
                  {info.dataRoot}
                </p>
                <p className={NOTE}>
                  Your decks, your settings, the card database and every downloaded picture live here.
                  Copy this folder to another computer and the app there will find all of it.
                </p>
                <button
                  type="button"
                  className={`mt-3 ${BTN}`}
                  onClick={() => void window.crt?.app.showDataFolder()}
                  data-setting-action="open-folder"
                >
                  <FolderOpen size={15} aria-hidden />
                  Open my files folder
                </button>
              </section>
            )}

            {updater && (
              <section className={CARD}>
                <h3 className={HEAD}>
                  <RotateCw size={14} aria-hidden /> Updates
                </h3>
                <p className="text-sm text-crt-dim" data-setting="updater">
                  {updater.message ?? `Status: ${updater.state}`}
                </p>
                {updater.state === 'skipped' && (
                  <p className={NOTE}>
                    Automatic updates are switched off in this build, so nothing is checked at launch
                    and no connection is made. You will be sent a new installer by hand.
                  </p>
                )}
              </section>
            )}

            <section className={CARD}>
              <h3 className={HEAD}>
                <Trash2 size={14} aria-hidden /> Start over
              </h3>
              <p className="text-sm text-crt-dim">
                Putting every setting back to its default does not touch your decks, your card
                database or your downloaded pictures.
              </p>
              <button
                type="button"
                className={`mt-3 ${BTN}`}
                onClick={() => {
                  void (async () => {
                    const bridge = window.crt;
                    if (!bridge) return;
                    const defaults = await bridge.settings.defaults();
                    // ⚠️ allowedOrigins is deliberately NOT reset from here. It is
                    // the CSP allowlist; clearing it silently would break a relay
                    // the user is mid-game on, and the header only changes on the
                    // next document load anyway.
                    const { allowedOrigins: _drop, ...rest } = defaults;
                    await update(rest);
                    setRelayDraft(null);
                    setRelayMessage('Settings are back to their defaults.');
                    setRelayNeedsReload(false);
                  })();
                }}
                data-setting-action="reset"
              >
                Put settings back to their defaults
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
