import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, LogOut, Play, Radio, Users, Wifi, WifiOff } from 'lucide-react';
import * as session from '../../game/session';
import { hostGame, joinGame } from '../../game/multiplayer';
import { useDecks } from '../../store/deckStore';
import { useSettings } from '../../store/settingsStore';
import { useUi } from '../../store/uiStore';
import type { LobbyView } from '../../net/protocol';

// Host a game, or join one.
//
// ⚠️ EVERY FAILURE ON THIS SCREEN SAYS WHAT TO DO NEXT, and "Could not connect"
// is the one message it must never produce. A room code that is not six
// characters, an address whose scheme is wrong, a relay that never answered and
// a card database that does not match are four completely different problems
// with four different fixes, and collapsing them into one sentence turns a
// thirty-second fix into an evening. Every message here comes from the layer
// that actually knows which of those happened — `netallow.cjs`, `multiplayer.ts`
// or the host — and this screen only decides where to put it.
//
// ⚠️ M5 fixed a silent styling bug worth remembering. This screen was written
// against `crt-line`, `crt-panel`, `crt-bg` and `crt-brass`, none of which are
// declared in `src/index.css`. Tailwind 4 emits a colour utility ONLY for a
// token it can find, so every one of those classes was absent from the
// stylesheet entirely — no border, no panel background, no button fill — with no
// build warning and no console error. Same family as D12 and as the runtime
// class-name trap in AGENTS.md: a Tailwind class that does not resolve is not a
// wrong colour, it is nothing at all. The tokens below are the real ones.

const PANEL = 'rounded-lg border border-crt-border bg-crt-surface p-4';
const BTN =
  'inline-flex items-center gap-1.5 rounded border border-crt-border-hi bg-crt-raised px-3 py-1.5 ' +
  'text-xs font-medium text-crt-text transition-colors hover:border-crt-accent hover:text-crt-accent-hi ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-crt-border-hi ' +
  'disabled:hover:text-crt-text';
const BTN_GHOST =
  'inline-flex items-center gap-1.5 rounded border border-crt-border px-3 py-1.5 text-xs text-crt-dim ' +
  'transition-colors hover:border-crt-border-hi hover:text-crt-text disabled:cursor-not-allowed ' +
  'disabled:opacity-40';
const FIELD =
  'w-full rounded border border-crt-border bg-crt-inset px-2 py-1.5 font-mono text-xs text-crt-text ' +
  'outline-none focus:border-crt-accent';
const LABEL = 'mb-1 block text-[11px] uppercase tracking-wider text-crt-faint';

export function MultiplayerScreen() {
  const decks = useDecks((s) => s.decks);
  const loadDecks = useDecks((s) => s.refresh);
  const settings = useSettings((s) => s.settings);
  const setScreen = useUi((s) => s.setScreen);

  const [deckId, setDeckId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageOk, setMessageOk] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [share, setShare] = useState<{ code: string; addresses: { name: string; url: string }[]; token?: string } | null>(
    null,
  );
  const [copied, setCopied] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinToken, setJoinToken] = useState('');
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [hosting, setHosting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [ready, setReadyLocal] = useState(false);

  useEffect(() => {
    void loadDecks();
  }, [loadDecks]);

  useEffect(() => {
    const apply = (snapshot: session.SessionSnapshot): void => {
      setLobby(snapshot.lobby);
      setHosting(snapshot.hosting);
      setConnected(snapshot.connected);
      // ⚠️ The session's own message wins over ours once a game exists: it is
      // the one that knows about a desync, a refused intent or a dropped socket,
      // and ours is at best a stale memory of how the connection started.
      if (snapshot.message) {
        setMessage(snapshot.message);
        setMessageOk(false);
      }
      if (snapshot.running) setScreen('table');
    };
    apply(session.current());
    return session.subscribe(apply);
  }, [setScreen]);

  const run = useCallback(async (work: () => Promise<{ ok: boolean; message: string; needsReload: boolean }>) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await work();
      setMessage(result.message);
      setMessageOk(result.ok);
      setNeedsReload(result.needsReload);
    } catch (err) {
      // ⚠️ Even the catch-all carries the real text. A thrown error here is
      // almost always the transport saying something specific ("no such room",
      // "the room is full", "your card database does not match the host's"), and
      // replacing it with a generic sentence would throw away the only clue.
      setMessage(err instanceof Error ? err.message : String(err));
      setMessageOk(false);
    } finally {
      setBusy(false);
    }
  }, []);

  const onHost = (mode: 'lan' | 'relay') =>
    void run(async () => {
      const result = await hostGame({
        mode,
        playerName: settings.playerName || 'Player',
        relayUrl: settings.relayUrl,
        deckId,
      });
      if (result.ok && result.join) {
        setShare({
          code: result.join.code,
          addresses: [...result.addresses],
          ...(result.join.token !== undefined ? { token: result.join.token } : {}),
        });
      }
      return { ok: result.ok, message: result.message, needsReload: result.needsReload };
    });

  const onJoin = () =>
    void run(async () => {
      const result = await joinGame({
        url: joinUrl.trim(),
        code: joinCode,
        ...(joinToken.trim() !== '' ? { token: joinToken.trim() } : {}),
        playerName: settings.playerName || 'Player',
        deckId,
      });
      return { ok: result.ok, message: result.message, needsReload: result.needsReload };
    });

  const start = (): void => {
    const host = session.hostSession();
    if (!host) return;
    const result = host.start();
    setMessage(result.message);
    setMessageOk(result.ok);
  };

  const leave = (): void => {
    session.stop();
    void window.crt?.lan.stop();
    setShare(null);
    setLobby(null);
    setReadyLocal(false);
    setMessage('You left the game. Nobody else was disconnected.');
    setMessageOk(true);
  };

  const copy = (text: string, key: string): void => {
    void navigator.clipboard?.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
  };

  const seats = lobby?.seats ?? [];
  const everyoneReady = seats.length >= 2 && seats.every((s) => s.ready);
  const inLobby = lobby !== null;

  return (
    <div className="flex-1 overflow-auto p-6" data-screen="multiplayer">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-start gap-3">
          <Users size={22} className="mt-1 text-crt-accent" aria-hidden />
          <div>
            <h1 className="font-display text-lg">Play with friends</h1>
            <p className="mt-1 text-sm text-crt-dim">
              One player hosts and reads out the room code; everyone else joins. The host runs the
              rules for the whole table, so their app has to stay open until the game ends.
            </p>
          </div>
        </header>

        {/* The connection state, stated rather than implied. */}
        {inLobby && (
          <p
            className={`mt-4 flex items-center gap-2 text-xs ${connected ? 'text-crt-ok' : 'text-crt-warn'}`}
            data-mp="connection"
          >
            {connected ? <Wifi size={14} aria-hidden /> : <WifiOff size={14} aria-hidden />}
            {connected
              ? hosting
                ? 'You are hosting. Your app runs the rules for everyone.'
                : 'Connected to the host.'
              : 'The connection dropped. The app is trying to get it back — nothing needs typing.'}
          </p>
        )}

        {!inLobby && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <section className={PANEL}>
              <h2 className="font-sc flex items-center gap-2 text-sm tracking-wider text-crt-text">
                <Wifi size={14} aria-hidden /> Host
              </h2>
              <label className={`mt-3 ${LABEL}`} htmlFor="mp-deck">
                Your deck
              </label>
              <select
                id="mp-deck"
                className={FIELD}
                value={deckId ?? ''}
                onChange={(e) => setDeckId(e.target.value === '' ? null : e.target.value)}
                data-mp="deck"
              >
                <option value="">Starter deck (not a legal Commander deck)</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={BTN} disabled={busy} onClick={() => onHost('lan')} data-mp="host-lan">
                  Host on this network
                </button>
                <button
                  type="button"
                  className={BTN_GHOST}
                  disabled={busy || settings.relayUrl.trim() === ''}
                  onClick={() => onHost('relay')}
                  data-mp="host-relay"
                  title={
                    settings.relayUrl.trim() === ''
                      ? 'Set a relay address on the Settings screen first'
                      : settings.relayUrl
                  }
                >
                  <Radio size={12} aria-hidden />
                  Host over a relay
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-crt-faint">
                Hosting on this network works with no server at all — everyone has to be on the same
                Wi-Fi, or on the same VPN. A relay lets people join from anywhere, and needs one you
                have set up yourself.
              </p>
            </section>

            <section className={PANEL}>
              <h2 className="font-sc text-sm tracking-wider text-crt-text">Join</h2>
              <label className={`mt-3 ${LABEL}`} htmlFor="mp-url">
                Host address
              </label>
              <input
                id="mp-url"
                className={FIELD}
                placeholder="ws://192.168.1.42:5282"
                value={joinUrl}
                onChange={(e) => setJoinUrl(e.target.value)}
                data-mp="join-url"
              />
              <label className={`mt-2 ${LABEL}`} htmlFor="mp-code">
                Room code
              </label>
              <input
                id="mp-code"
                className={`${FIELD} uppercase tracking-[0.3em]`}
                placeholder="K7M2QX"
                maxLength={8}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                data-mp="join-code"
              />
              <label className={`mt-2 ${LABEL}`} htmlFor="mp-token">
                Join key
              </label>
              <input
                id="mp-token"
                className={FIELD}
                placeholder="from the host's screen"
                value={joinToken}
                onChange={(e) => setJoinToken(e.target.value)}
                data-mp="join-token"
              />
              {/* ⚠️ D59. The join key is the thing people get stuck on, because a
                  relay game does not use one and a local game will not work
                  without it. Say which is which, here, next to the field. */}
              <p className="mt-1 text-[11px] leading-relaxed text-crt-faint">
                Games on a local network need this — it is the long line on the host&apos;s screen,
                and it is what stops a stranger on the same Wi-Fi joining. Leave it empty for a relay
                game.
              </p>
              <button type="button" className={`mt-3 ${BTN}`} disabled={busy} onClick={onJoin} data-mp="join">
                Join game
              </button>
            </section>
          </div>
        )}

        {share && (
          <section className={`mt-4 ${PANEL}`} data-mp="share">
            <h2 className="font-sc text-sm tracking-wider text-crt-text">Read this out</h2>
            <div className="mt-2 flex items-center gap-3">
              <p className="crt-num text-2xl tracking-[0.4em] text-crt-accent" data-mp="code">
                {share.code}
              </p>
              <button type="button" className={BTN_GHOST} onClick={() => copy(share.code, 'code')}>
                {copied === 'code' ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
                {copied === 'code' ? 'Copied' : 'Copy'}
              </button>
            </div>

            {share.addresses.length > 0 && (
              <>
                <p className={`mt-3 ${LABEL}`}>Addresses on this network</p>
                <ul className="space-y-1 font-mono text-xs text-crt-dim">
                  {share.addresses.map((a) => (
                    <li key={a.url} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 truncate text-crt-faint">{a.name}</span>
                      <span className="text-crt-text">{a.url}</span>
                      <button type="button" className={BTN_GHOST} onClick={() => copy(a.url, a.url)}>
                        {copied === a.url ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-crt-faint">
                  If one address does not work, try the next — a computer usually has several.
                </p>
              </>
            )}

            {share.token && (
              <>
                <p className={`mt-3 ${LABEL}`}>Join key</p>
                <div className="flex items-start gap-2">
                  <p className="break-all font-mono text-[11px] text-crt-dim" data-mp="token">
                    {share.token}
                  </p>
                  <button type="button" className={BTN_GHOST} onClick={() => copy(share.token!, 'token')}>
                    {copied === 'token' ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-crt-faint">
                  Everyone joining on this network needs this as well as the code. It is what stops
                  someone else on the same Wi-Fi walking into your game.
                </p>
              </>
            )}
          </section>
        )}

        {lobby && (
          <section className={`mt-4 ${PANEL}`} data-mp="lobby">
            <h2 className="font-sc text-sm tracking-wider text-crt-text">
              Lobby — <span className="crt-num tracking-[0.2em] text-crt-accent">{lobby.code}</span>{' '}
              <span className="text-crt-faint">({seats.length}/4)</span>
            </h2>

            <ul className="mt-3 space-y-1.5 text-xs">
              {seats.map((seat) => (
                <li
                  key={seat.id}
                  className="flex items-center justify-between gap-3 rounded border border-crt-border/60 bg-crt-inset/50 px-2 py-1.5"
                  data-mp-seat={seat.id}
                >
                  <span className="flex items-center gap-2 text-crt-text">
                    {seat.name}
                    {!seat.connected && (
                      <span className="text-crt-warn" data-mp-seat-state="disconnected">
                        (disconnected — they can rejoin on the same code)
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-crt-dim">
                    <span className="text-crt-faint">{seat.deckName ?? 'no deck yet'}</span>
                    <span className={seat.ready ? 'text-crt-ok' : 'text-crt-faint'}>
                      {seat.ready ? 'ready' : 'not ready'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={ready ? BTN_GHOST : BTN}
                onClick={() => {
                  session.setReady(!ready);
                  setReadyLocal(!ready);
                }}
                data-mp="ready"
              >
                {ready ? 'I am not ready after all' : 'I am ready'}
              </button>
              {hosting && (
                <button type="button" className={BTN} disabled={!everyoneReady} onClick={start} data-mp="start">
                  <Play size={12} aria-hidden />
                  Start the game
                </button>
              )}
              <button type="button" className={BTN_GHOST} onClick={leave} data-mp="leave">
                <LogOut size={12} aria-hidden />
                Leave
              </button>
            </div>

            {/* ⚠️ Say WHY the start button is disabled. A greyed-out button with
                no explanation is the single most common way a lobby stalls: the
                host waits for something to change and nobody knows what. */}
            {hosting && !everyoneReady && (
              <p className="mt-2 text-[11px] text-crt-faint" data-mp="start-blocked">
                {seats.length < 2
                  ? 'Waiting for at least one more player to join.'
                  : `Waiting for ${seats
                      .filter((s) => !s.ready)
                      .map((s) => s.name)
                      .join(', ')} to say they are ready.`}
              </p>
            )}
          </section>
        )}

        {message && (
          <p
            className={`mt-4 flex flex-wrap items-center gap-2 text-xs ${messageOk ? 'text-crt-ok' : 'text-crt-warn'}`}
            data-mp="message"
          >
            {message}
            {needsReload && (
              <button
                type="button"
                className={BTN_GHOST}
                onClick={() => void window.crt?.net.reload()}
                data-mp="reload"
              >
                Reload now
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
