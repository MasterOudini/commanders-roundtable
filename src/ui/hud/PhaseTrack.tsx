import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { PHASES, PHASE_GROUPS, type PlayerView } from '../../view/types';
import { useLayout } from '../../store/layoutStore';
import { EASE, ds, DUR } from '../anim/tokens';

// The phase strip. Two rows: the five PHASES of a turn across the top, the twelve
// STEPS beneath them, with the current step marked and whose turn it is on the left.
//
// ⚠️ Two rows rather than one because a step name alone does not say where you
// are. "End" is a combat step and "End step" is the ending phase; "Main" happens
// twice. The header row is what disambiguates them, so the step row can spend its
// width on a real name instead of a two-letter code nobody learns.
//
// The markers are single sliding elements rather than a class on the active cell:
// one transform animation instead of two class changes, and the movement itself is
// the cue that the turn advanced — you notice a slide in peripheral vision, which
// is the point during someone else's turn.
//
// ⚠️ BOTH MARKERS ARE RENDERED BEFORE THE LABELS. They are painted-under
// backgrounds, and everything here is positioned, so tree order is the only thing
// deciding what covers what. With the marker last it sat exactly on the current
// cell and hid the one label you most need to read — a solid brass block where
// the step name should be. The explicit z-indices below say so out loud.
//
// ⚠️ `PriorityIndicator` is separate and reads `promptStore`-style state directly,
// because whose priority it is must NEVER lag the animation queue. The phase MAY
// lag by a group; priority may not.

/**
 * The status block on the left. Fixed, because the track's cells are solved
 * against whatever width it leaves behind. Wide enough to hold the longest
 * phase name — "Declare attackers", measured at 111 px — beside the priority
 * chip, which is what the compact form below leans on.
 */
const STATUS_W = 208;
/**
 * Under this, a step cell cannot hold its name and falls back to `short`.
 * Measured, not guessed: the widest step name is "Attackers" at 53 px in
 * Alegreya SC 11 px, and a cell spends 8 px on padding.
 */
const MIN_NAME_W = 64;
/**
 * The right-hand control slot, RESERVED rather than sized to its contents.
 * The widest thing the table screen puts there is "Set up a solo game" at
 * 127 px. Fixing it does two jobs: the step cells stop changing width when the
 * button's label changes, and `compact` below can be arithmetic instead of a
 * measurement — a caller-provided node has no width this component could know.
 */
const RIGHT_W = 132;
/** The root's own gap and right padding, in one place so `compact` cannot drift. */
const GAP = 12;
const PAD_R = 12;

/** Where each group starts, in step columns. The spans are contiguous. */
const GROUP_OFFSETS: number[] = PHASE_GROUPS.reduce<number[]>((acc, _g, i) => {
  acc.push(i === 0 ? 0 : (acc[i - 1] ?? 0) + (PHASE_GROUPS[i - 1]?.span ?? 0));
  return acc;
}, []);

const pct = (n: number): string => `${(n * 100) / PHASES.length}%`;

export function PhaseTrack({ view, right }: { view: PlayerView; right?: ReactNode }) {
  // The solved table width, not a measured one — `useTableMetrics` has already
  // done this arithmetic for the whole table and reading it back costs nothing.
  const tableW = useLayout((s) => s.metrics.tableW);
  const trackW = tableW - STATUS_W - GAP - (right ? GAP + RIGHT_W : 0) - PAD_R;
  const compact = trackW / PHASES.length < MIN_NAME_W;

  const index = Math.max(
    0,
    PHASES.findIndex((p) => p.id === view.turn.phase),
  );
  const current = PHASES[index];
  const groupIndex = Math.max(
    0,
    PHASE_GROUPS.findIndex((g) => g.id === current?.group),
  );
  const group = PHASE_GROUPS[groupIndex];

  const myTurn = view.turn.active === view.me;
  const activeName = view.seats[view.turn.active]?.name ?? view.turn.active;

  /**
   * Nobody has taken a turn yet — everyone is still keeping or mulliganing.
   *
   * ⚠️ The bar read "TURN 0" and lit UNTAP, which is not a thing that is
   * happening: the first `TurnBegan` is what makes it turn 1, so before that
   * the step the view reports is a default rather than a fact. A track that
   * confidently marks a step nobody is in is worse than one that marks none.
   *
   * ⚠️ `turnNumber < 1` cannot collide with the fixture path — `emptyView()`
   * starts at 1 — so this never blanks the track in the M2 scenarios.
   */
  const pregame = view.turn.turnNumber < 1;

  return (
    <div
      className="flex h-[48px] items-stretch border-b border-crt-border/60 bg-crt-surface/70"
      style={{ gap: GAP, paddingRight: PAD_R }}
      data-phase-track={pregame ? 'pregame' : view.turn.phase}
      data-phase-group={pregame ? undefined : group?.id}
      data-pregame={pregame ? '1' : undefined}
      aria-label={
        pregame
          ? `Mulligans — ${myTurn ? 'you go' : `${activeName} goes`} first`
          : `Turn ${view.turn.turnNumber}, ${myTurn ? 'your turn' : `${activeName}'s turn`}, ${group?.label} — ${current?.label}`
      }
    >
      {/* ── Whose turn, and who the game is waiting on ──────────────────────── */}
      <div
        className="flex shrink-0 flex-col justify-center gap-[3px] border-l-2 pl-3"
        style={{
          width: STATUS_W,
          borderLeftColor: myTurn ? 'var(--color-crt-accent)' : 'transparent',
        }}
        data-turn-owner={view.turn.active}
      >
        <span className="flex items-baseline gap-1.5 leading-none">
          {pregame ? (
            <span className="font-sc text-[10px] tracking-wider text-crt-faint">MULLIGANS</span>
          ) : (
            <>
              <span className="font-sc text-[10px] tracking-wider text-crt-faint">TURN</span>
              <span className="crt-num text-[13px] leading-none text-crt-text">
                {view.turn.turnNumber}
              </span>
            </>
          )}
          {/* Brass whoever it is — this IS the turn owner, and the same brass
              lights their pod. "YOUR" is what distinguishes mine, not a
              different colour, so the two signals cannot disagree.
              Before turn 1 they are not taking a turn yet; they are the player
              who will, which is a fact worth saying while hands are being kept. */}
          <span
            className="font-sc truncate text-[11px] tracking-wider text-crt-accent-hi"
            data-turn-label=""
          >
            {pregame
              ? myTurn
                ? 'YOU GO FIRST'
                : `${activeName.toUpperCase()} GOES FIRST`
              : myTurn
                ? 'YOUR TURN'
                : `${activeName.toUpperCase()}’S TURN`}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <PriorityIndicator view={view} />
          {/* ⚠️ Only when the track has fallen back to two-letter codes. The
              point of the whole component is that "what phase is this" is never
              a thing you have to decode, and at the minimum window width the
              cells cannot hold a name — so the name comes and stands here
              instead. Above that width the track says it, and repeating it here
              would just be noise. */}
          {compact && !pregame && (
            <span
              className="font-sc truncate text-[11px] tracking-wide text-crt-accent-hi"
              data-phase-name=""
            >
              {current?.label.toUpperCase()}
            </span>
          )}
        </span>
      </div>

      {/* ── The two rows ────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-[3px] py-[5px]">
        {/* Phases. */}
        <div className="relative h-[15px]">
          {!pregame && (
            <motion.div
              aria-hidden
              className="absolute inset-y-0 z-0 rounded-[3px] bg-crt-accent-lo/35"
              animate={{ left: pct(GROUP_OFFSETS[groupIndex] ?? 0), width: pct(group?.span ?? 1) }}
              transition={{ duration: ds(DUR.landDrop), ease: EASE.out }}
              data-phase-group-marker={groupIndex}
            />
          )}
          <div
            className="relative z-10 grid h-full"
            style={{ gridTemplateColumns: `repeat(${PHASES.length}, minmax(0,1fr))` }}
          >
            {PHASE_GROUPS.map((g, i) => (
              <div
                key={g.id}
                data-phase-group-cell={g.id}
                data-phase-group-current={!pregame && i === groupIndex ? '1' : undefined}
                className={`flex items-center justify-center overflow-hidden ${
                  i > 0 ? 'border-l border-crt-border/40' : ''
                }`}
                style={{ gridColumn: `span ${g.span}` }}
              >
                <span
                  className={`font-sc truncate ${
                    // A one-step phase gets ONE cell — 38 px at the minimum
                    // window — and "MAIN 1" does not fit there at reading
                    // tracking. The letter-spacing is what gives, not the name.
                    compact ? 'px-0 text-[9px] tracking-[0.05em]' : 'px-1 text-[10px] tracking-[0.16em]'
                  } ${!pregame && i === groupIndex ? 'text-crt-accent-hi' : 'text-crt-faint'}`}
                >
                  {g.label.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Steps. */}
        <div className="relative h-[19px]">
          {!pregame && (
            <motion.div
              aria-hidden
              className="absolute inset-y-0 z-0"
              style={{ width: pct(1) }}
              animate={{ left: pct(index) }}
              transition={{ duration: ds(DUR.landDrop), ease: EASE.out }}
              data-phase-marker={index}
            >
              <div className="absolute inset-x-[1px] inset-y-0 rounded-[3px] bg-crt-accent" />
            </motion.div>
          )}
          <div
            className="relative z-10 grid h-full"
            style={{ gridTemplateColumns: `repeat(${PHASES.length}, minmax(0,1fr))` }}
          >
            {PHASES.map((p, i) => {
              const startsGroup = i > 0 && p.group !== PHASES[i - 1]?.group;
              return (
                <div
                  key={p.id}
                  data-phase={p.id}
                  data-phase-current={!pregame && i === index ? '1' : undefined}
                  className={`flex items-center justify-center overflow-hidden ${
                    startsGroup ? 'border-l border-crt-border/40' : ''
                  }`}
                  title={p.label}
                >
                  <span
                    className={`font-sc truncate px-1 text-[11px] tracking-wide ${
                      pregame
                        ? 'text-crt-faint'
                        : i === index
                          ? 'text-crt-on-accent'
                          : i < index
                            ? 'text-crt-dim'
                            : 'text-crt-faint'
                    }`}
                  >
                    {compact ? p.short : p.step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Game-level controls belong in the game-level bar. Empty in fixture mode,
          where the slot collapses to nothing. */}
      {right && (
        <div className="flex shrink-0 items-center justify-end" style={{ width: RIGHT_W }}>
          {right}
        </div>
      )}
    </div>
  );
}

/**
 * Who can act right now.
 *
 * ⚠️ GREEN, NOT BRASS — and that is the whole point of the colour. Brass is
 * whose TURN it is (`PlayerPod`, and the turn label above). They are different
 * questions and both are true at once for most of a turn, so painting them the
 * same colour meant a lit pod answered neither: you could not tell "it is Ben's
 * turn" from "Ben can act". Green is 152° against brass's 78°, which survives
 * being read out of the corner of an eye.
 *
 * ⚠️ Green is close to green MANA (148°), and the rule it is bending says the
 * five colours appear in five places. It holds because none of those places is
 * here: this is HUD chrome and a nameplate ring, never a card and never a pip.
 *
 * ⚠️ "YOU MAY ACT" / "CY TO ACT" — one vocabulary, from the player's side. The
 * pair used to be "YOUR PRIORITY" / "CY TO ACT", which asks a new player to
 * learn that those are the same fact about two different people.
 */
export function PriorityIndicator({ view }: { view: PlayerView }) {
  const name = view.priority ? (view.seats[view.priority]?.name ?? view.priority) : null;
  const mine = view.priority === view.me;
  return (
    <span
      role="status"
      className={`font-sc w-fit rounded-[3px] px-1.5 py-[1px] text-[10px] leading-[13px] tracking-wider ${
        mine
          ? 'bg-crt-ok text-crt-void'
          : name === null
            ? 'text-crt-faint'
            : 'border border-crt-ok/40 text-crt-dim'
      }`}
      data-priority-player={view.priority ?? 'none'}
      data-priority-mine={mine ? '1' : undefined}
    >
      {name === null ? 'NOBODY TO ACT' : mine ? 'YOU MAY ACT' : `${name.toUpperCase()} TO ACT`}
    </span>
  );
}
