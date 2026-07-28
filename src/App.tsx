import { useEffect } from 'react';
import { Swords } from 'lucide-react';
import { HomeScreen } from './ui/screens/HomeScreen';
import { DecksScreen } from './ui/screens/DecksScreen';
import { CardDatabaseScreen } from './ui/screens/CardDatabaseScreen';
import { SoloScreen } from './ui/screens/SoloScreen';
import { MultiplayerScreen } from './ui/screens/MultiplayerScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { AboutScreen } from './ui/screens/AboutScreen';
import { CardFixtureScreen } from './ui/screens/CardFixtureScreen';
import { TokenGalleryScreen } from './ui/screens/TokenGalleryScreen';
import { FlightTestScreen } from './ui/screens/FlightTestScreen';
import { BeatsScreen } from './ui/screens/BeatsScreen';
import { TableScreen } from './ui/screens/TableScreen';
import { MotionRoot } from './ui/anim/MotionRoot';
import { DragLayer } from './ui/table/DragLayer';
import { ArrowLayer } from './ui/game/ArrowLayer';
import { FlightOverlay } from './ui/anim/FlightOverlay';
import { FxOverlay } from './ui/anim/FxOverlay';
import { FxCanvas } from './ui/anim/fx/FxCanvas';
import { installRectDiscipline, resetStrayRectReads, sample, strayRectReadCount } from './ui/anim/perf';
import { flush, holdFastForward } from './ui/anim/choreographer';
import { useSettings } from './store/settingsStore';
import { useUi, type ScreenId } from './store/uiStore';
import { exposeDevHandles } from './devHandles';

// Screen switching is a hash + uiStore, not a router library. There are ~8
// screens, no nested routes, no URL sharing, and no deep links — a router would
// be a dependency earning nothing. Revisit if that stops being true.
//
// ⚠️ `persistent` screens are ALWAYS mounted and merely hidden with
// `display: none`. The table must never unmount: it owns the choreographer
// queue, ~50 live MotionValues, the decoded-image cache, and (from M4) the
// socket. Unmounting it mid-game means a desync plus a re-download storm.
// cartapriscus learned this with Pixi; same lesson, different renderer.
//
// A hidden-but-live table is why the choreographer has digest mode: it keeps
// consuming events and committing state while invisible, it just stops flying
// clones. It must never PAUSE, or the view diverges from the log.

interface ScreenDef {
  label: string;
  render: () => React.ReactNode;
  devOnly?: boolean;
  persistent?: boolean;
}

const SCREENS: Record<ScreenId, ScreenDef> = {
  home: { label: 'Home', render: () => <HomeScreen /> },
  decks: { label: 'Decks', render: () => <DecksScreen /> },
  carddb: { label: 'Card database', render: () => <CardDatabaseScreen /> },
  solo: { label: 'Play solo', render: () => <SoloScreen /> },
  multiplayer: { label: 'Play with friends', render: () => <MultiplayerScreen /> },
  table: { label: 'Table', render: () => <TableScreen />, persistent: true },
  settings: { label: 'Settings', render: () => <SettingsScreen /> },
  about: { label: 'About', render: () => <AboutScreen /> },
  cards: { label: 'Cards (dev)', render: () => <CardFixtureScreen />, devOnly: true },
  tokens: { label: 'Tokens (dev)', render: () => <TokenGalleryScreen />, devOnly: true },
  flight: { label: 'Flight (dev)', render: () => <FlightTestScreen />, devOnly: true },
  beats: { label: 'Beats (dev)', render: () => <BeatsScreen />, devOnly: true },
};

function screenFromHash(): ScreenId {
  const id = window.location.hash.replace(/^#/, '') as ScreenId;
  return id in SCREENS ? id : 'home';
}

export default function App() {
  const screen = useUi((s) => s.screen);
  const setScreen = useUi((s) => s.setScreen);
  const hydrate = useSettings((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
    // Dev-only: makes the "rectRegistry is the only legal caller of
    // getBoundingClientRect" rule measurable instead of aspirational.
    installRectDiscipline();
  }, [hydrate]);

  useEffect(() => {
    // ⚠️ Hold Space → every LIVE flight's playback `speed` is set to 4, not just
    // future ones; Esc → flush the queue to its final pose. Both are keyboard
    // events, which is deliberate: keyboard events do not suffer the
    // real-mouse/synthetic-pointer interleaving problem, so they are also the one
    // interaction a probe can safely dispatch for real.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement | null;
        // Space is also "activate" on a focused control; don't steal it.
        if (target && /^(BUTTON|INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
        e.preventDefault();
        holdFastForward(true);
      } else if (e.key === 'Escape') {
        flush();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') holdFastForward(false);
    };
    // Releasing Space while the window is not focused would leave it stuck on.
    const onBlur = () => holdFastForward(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    // The hash is the source of truth; the store mirrors it. One listener, and
    // an initial sync so a deep-linked #tokens load lands on the right screen.
    const sync = () => useUi.getState().setScreen(screenFromHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    // ⚠️ These handles must NOT close over component state or setters. An earlier
    // version had `goto` call setScreen from the render it was registered in;
    // after an HMR remount that setter belonged to a dead instance, so goto()
    // silently did nothing and a probe reported "the screen has no cards" —
    // indistinguishable from a render bug. Same family as the ghost-store trap in
    // AGENTS.md: never let a probe handle capture a live binding.
    // Setting the hash is enough; the hashchange listener drives the store.
    exposeDevHandles({
      settings: useSettings,
      ui: useUi,
      // ⚠️ App-level, not screen-level. Registered from the beats screen it was
      // absent from any run that never visited #beats — the perf section died on
      // `window.__crt.perf.sample` being undefined, which reads as a missing
      // feature rather than as a registration in the wrong place.
      perf: { sample, strayRectReads: strayRectReadCount, resetStrayRectReads },
      goto: (id: ScreenId) => { window.location.hash = id; },
      screen: () => useUi.getState().screen,
    });
  }, []);

  const entries = Object.entries(SCREENS) as [ScreenId, ScreenDef][];
  const tabs = entries.filter(([, s]) => !s.devOnly || import.meta.env.DEV);
  const persistent = entries.filter(([, s]) => s.persistent);
  const active = SCREENS[screen];

  return (
    <MotionRoot>
      <div className="flex h-full flex-col bg-crt-void text-crt-text">
        <header className="flex shrink-0 items-center gap-4 border-b border-crt-border bg-crt-surface px-5 py-3">
          <Swords size={20} className="text-crt-accent" aria-hidden />
          <h1 className="font-display text-lg tracking-wide">Commander&apos;s Roundtable</h1>

          {tabs.length > 1 && (
            <nav className="ml-4 flex gap-1">
              {tabs.map(([id, s]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { window.location.hash = id; setScreen(id); }}
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    screen === id
                      ? 'bg-crt-raised text-crt-accent-hi'
                      : 'text-crt-faint hover:text-crt-text'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          )}
        </header>

        {/* One relative host so the persistent slots and the active screen stack. */}
        <div className="relative min-h-0 flex-1">
          {persistent.map(([id, s]) => (
            <div
              key={id}
              data-screen-slot={id}
              className="absolute inset-0"
              style={{ display: screen === id ? undefined : 'none' }}
            >
              {s.render()}
            </div>
          ))}

          {!active.persistent && (
            <div data-screen-slot={screen} className="absolute inset-0">
              {active.render()}
            </div>
          )}
        </div>

        {/* Above every screen and outside every screen's DOM, so an in-flight card
            is never clipped by a zone's overflow and never trapped under a
            sibling panel's stacking context. */}
        {/* Order matters: particles under the flight clones, floating numbers above
            both. A damage number under a card is a number nobody reads. */}
        <FxCanvas />
        <FlightOverlay />
        {/* The held card, for the same reason and in the same place: a fixed
            overlay must not sit inside anything that could become its containing
            block. It sits above the flight clones — the card in your hand is the
            one you are steering. */}
        <DragLayer />
        {/* The targeting arrow. At the app root for the same reason DragLayer is,
            plus one that is stronger here: PlayerPod sets contain: layout paint,
            which would both reposition and CLIP a fixed child. */}
        <ArrowLayer />
        <FxOverlay />
      </div>
    </MotionRoot>
  );
}
