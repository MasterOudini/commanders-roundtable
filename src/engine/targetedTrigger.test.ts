// A triggered ability that TARGETS — M6.3t. See D147.
//
// ⚠️ WHAT WAS BROKEN: `PendingTrigger` carried no targets, `TriggerDef` had no
// way to declare any, and `drainTriggers` built every stack object with
// `targets: []`. So every card whose triggered ability names a target was
// unscriptable however simple the rest of it was — measured at **3,218 of
// 31,692** distinct Commander-legal cards, the largest family in this arc.
//
// ⚠️ Driven with a REAL CARD (D128's rule). `Yotian Dissident`'s whole printed
// text is one targeted trigger, its effect needs nothing new (`CountersChanged`
// has been on the log since D107), and its target is RESTRICTED — "you control".
// That last part is why it was chosen over the 926 lines that read plain "target
// creature": an unrestricted clause passes with `targetAllowed` never consulted,
// which is a green tick over nothing.

import { describe, expect, test } from 'vitest';
import { Game } from './game';
import { replay, stateHash } from './log';
import { canBlock } from './combat';
import { costStringOf, manaSourcesOf } from './mana';
import { engineCompleteness } from '../data/engineComplete';
import { createRegistry, NO_SCRIPTS } from './scripts/registry';
import { SPINELESS_THUG_SCRIPT } from './testing/cardScripts';
// The SHIPPED Onulet (M6.4a) and Yotian Dissident (M6.4c) — the testing copies
// they replaced are gone, so these cases drive the scripts the app runs.
import { ONULET_SCRIPT } from './scripts/cards/onulet';
import { YOTIAN_DISSIDENT_SCRIPT } from './scripts/cards/yotianDissident';
import { advanceUntil, holdEverywhere, must, ORACLE, put, startedGame } from './testing/harness';
import type { GameState, TargetChoice } from './types/state';

const YOTIAN = 'Yotian Dissident';
const ARTIFACT = 'Darksteel Citadel';
const BEARS = 'Grizzly Bears';

const REGISTRY = createRegistry([YOTIAN_DISSIDENT_SCRIPT]);

interface Board {
  readonly game: Game;
  /** The Dissident — a creature p1 controls, so a legal target for itself. */
  readonly self: string;
  readonly mine: string | null;
  readonly theirs: string | null;
}

function countersOn(state: GameState, id: string): number {
  return state.cards[id]?.counters['+1/+1'] ?? 0;
}

/**
 * p1 with a Dissident out and an artifact just played.
 *
 * ⚠️ Every id comes back from `put`, which returns the instance it moved — a
 * `CardInstance` carries no name, so searching the battlefield for one finds
 * nothing at all. That cost the first run of this file eight failures.
 */
function board(opts: { theirs?: boolean; mine?: boolean; killSelf?: boolean } = {}): Board {
  const game = startedGame({
    players: 2,
    decks: [[YOTIAN, ARTIFACT, BEARS], [BEARS]],
    scripts: REGISTRY,
  });
  holdEverywhere(game);
  const self = put(game, 'p1', YOTIAN);
  const mine = opts.mine ? put(game, 'p1', BEARS) : null;
  const theirs = opts.theirs ? put(game, 'p2', BEARS) : null;
  if (opts.killSelf) {
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
  }
  // ⚠️ The artifact is what TRIGGERS it. Everything above is board.
  put(game, 'p1', ARTIFACT);
  return { game, self, mine, theirs };
}

function atThePrompt(opts: { theirs?: boolean; mine?: boolean } = {}): Board {
  const b = board(opts);
  advanceUntil(b.game, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return b;
}

function targetsPrompt(game: Game): Extract<NonNullable<GameState['priority']['awaiting']>, { kind: 'chooseTargets' }> {
  const a = game.state.priority.awaiting;
  if (a?.kind !== 'chooseTargets') throw new Error(`expected a targets prompt, got ${a?.kind}`);
  return a;
}

// ⚠️ A permanent on the battlefield is kind 'card'. `TargetChoice` has exactly
// three kinds — card, player, stack — and 'creature' is not one of them; the
// CARD TYPE lives on the spec, never on the pick.
function card(id: string): TargetChoice {
  return { kind: 'card', id };
}

describe('a triggered ability that targets', () => {
  test('the spec is read from the CARD, not hand-written beside it', () => {
    const specs = YOTIAN_DISSIDENT_SCRIPT.triggers?.[0]?.targets ?? [];
    expect(specs).toHaveLength(1);
    // "put a +1/+1 counter on target creature you control"
    expect(specs[0]?.min).toBe(1);
    expect(specs[0]?.max).toBe(1);
    expect(specs[0]?.kinds).toContain('creature');
    // ⚠️ THE RESTRICTION IS THE WHOLE POINT. If the parser ever stopped reading
    // "you control", this fails here rather than silently widening what the
    // trigger may hit — the failure D139 found in the spell path.
    expect(specs[0]?.controller).toBe('you');
  });

  test('it stops and asks, with the ability ALREADY on the stack (CR 603.3d)', () => {
    const { game, self } = atThePrompt();
    const a = targetsPrompt(game);
    expect(a.forKind).toBe('trigger');
    expect(a.player).toBe('p1');
    expect(a.count).toBe(1);
    expect(a.source).toBe(self);
    // ⚠️ The object is on the stack while the prompt is up — that is what makes
    // `stackId` nameable, and it is the difference from a spell, which is still
    // in `pendingCast` at this moment.
    expect(game.state.stack[game.state.stack.length - 1]?.id).toBe(a.stackId);
    expect(game.state.pendingCast).toBeNull();
    // Nothing has resolved: the counter is not on anything yet.
    expect(countersOn(game.state, self)).toBe(0);
  });

  test('answering writes the targets onto the stack object', () => {
    const { game, self } = atThePrompt();
    const a = targetsPrompt(game);
    must(game.submit({ t: 'ChooseTargets', player: 'p1', targets: [card(self)] }));
    expect(game.state.stack.find((o) => o.id === a.stackId)?.targets).toEqual([card(self)]);
    expect(game.state.priority.awaiting).toBeNull();
  });

  test('and it resolves onto the creature that was chosen', () => {
    const { game, self, mine } = atThePrompt({ mine: true });
    must(game.submit({ t: 'ChooseTargets', player: 'p1', targets: [card(mine!)] }));
    advanceUntil(game, (s) => s.stack.length === 0, 20_000);
    expect(countersOn(game.state, mine!)).toBe(1);
    // The other creature p1 controls got nothing — the target was a choice.
    expect(countersOn(game.state, self)).toBe(0);
  });

  // ── the restriction ────────────────────────────────────────────────────────

  test("an OPPONENT's creature is refused — the prompt vouches for nothing", () => {
    const { game, theirs } = atThePrompt({ theirs: true });
    const r = game.submit({ t: 'ChooseTargets', player: 'p1', targets: [card(theirs!)] });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toBe('illegalTarget');
    // Still asking, so the game has not moved on with an illegal pick.
    expect(targetsPrompt(game).forKind).toBe('trigger');
  });

  test('and so is somebody else answering it', () => {
    const { game, self } = atThePrompt({ theirs: true });
    expect(game.submit({ t: 'ChooseTargets', player: 'p2', targets: [card(self)] }).ok).toBe(false);
  });

  // ── CR 608.2b ──────────────────────────────────────────────────────────────

  test('a target that has left the battlefield stops it resolving (CR 608.2b)', () => {
    const { game, mine } = atThePrompt({ mine: true });
    must(game.submit({ t: 'ChooseTargets', player: 'p1', targets: [card(mine!)] }));
    // Killed in response — the whole reason targeting is two steps.
    must(
      game.submit({ t: 'ManualMoveCard', player: 'p1', card: mine!, to: { kind: 'graveyard', player: 'p1' } }),
    );
    advanceUntil(game, (s) => s.stack.length === 0, 20_000);
    expect(countersOn(game.state, mine!)).toBe(0);
    // ⚠️ And it SAYS so. A trigger that fizzles silently is indistinguishable
    // from a broken one — the mistake D137 spent four hours on.
    expect(
      game.log.some((e) => e.body.t === 'Narrated' && /does not resolve \(CR 608\.2b\)/.test(e.body.text)),
    ).toBe(true);
  });

  // ── CR 603.3d ──────────────────────────────────────────────────────────────

  test('with NO legal target it never reaches the stack at all (CR 603.3d)', () => {
    // The Dissident is binned BEFORE the artifact lands, so its ability still
    // triggers off the battlefield-leaving order but finds nothing it may aim
    // at: the only creature left belongs to p2.
    const { game, theirs } = board({ theirs: true, killSelf: true });
    advanceUntil(game, (s) => s.pendingTriggers.length === 0, 20_000);

    // ⚠️ NOT a prompt nobody can answer. A trigger has no `pendingCast` to
    // cancel, so an unanswerable targets prompt would stop the game forever —
    // D102's exact shape, prevented rather than recovered from.
    expect(game.state.priority.awaiting?.kind).not.toBe('chooseTargets');
    expect(countersOn(game.state, theirs!)).toBe(0);
  });

  // ── the log stays replayable ────────────────────────────────────────────────

  test('the whole sequence replays to the same state', () => {
    const { game, mine } = atThePrompt({ mine: true, theirs: true });
    must(game.submit({ t: 'ChooseTargets', player: 'p1', targets: [card(mine!)] }));
    advanceUntil(game, (s) => s.stack.length === 0, 20_000);
    // ⚠️ `StackTargetsSet` is a new event and `PendingTrigger.specs` a new field
    // on `GameState`, so both are in the state hash. A replay that diverged here
    // would mean the wire and the disk disagree about a game anyone played.
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });
});

// ── CR 603.10a — the trigger that looks back in time ─────────────────────────
//
// ⚠️ A DIES TRIGGER COULD NOT BE WRITTEN AT ALL before D147, and the reason is
// worth keeping: `collectTriggers` took `before` as a parameter and discarded it
// with `void before`, building every script context from `after`. So a card that
// triggers on its own death was rejected twice over — the zone check found it in
// a graveyard, and `matches` was handed a board it had already left.
describe('a trigger that looks back in time (CR 603.10a)', () => {
  const ONULET = 'Onulet';

  /** p1 with an Onulet on the battlefield, about to be binned. */
  function dying(script = ONULET_SCRIPT): { game: Game; onulet: string } {
    const game = startedGame({ players: 2, decks: [[ONULET]], scripts: createRegistry([script]) });
    holdEverywhere(game);
    const onulet = put(game, 'p1', ONULET);
    must(
      game.submit({ t: 'ManualMoveCard', player: 'p1', card: onulet, to: { kind: 'graveyard', player: 'p1' } }),
    );
    advanceUntil(game, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    return { game, onulet };
  }

  test('a creature that dies triggers off its own death', () => {
    const { game } = dying();
    expect(game.state.players['p1']?.life).toBe(42);
  });

  test('and with the flag OFF it never fires at all — on any board', () => {
    // ⚠️ THE BREAK TEST, IN THE SUITE. `looksBack` is a new field, and D128's
    // whole lesson is that a flag nothing reads looks exactly like a flag that
    // works. Flipping it here is what stops this one rotting the same way.
    const blind = {
      ...ONULET_SCRIPT,
      triggers: (ONULET_SCRIPT.triggers ?? []).map((t) => ({ ...t, looksBack: false })),
    };
    const { game } = dying(blind);
    expect(game.state.players['p1']?.life).toBe(40);
  });

  test('it replays to the same state', () => {
    const { game } = dying();
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });
});

// ── continuous combat restrictions (CR 508.1c / 509.1b) ──────────────────────
//
// ⚠️ D129 filed 227 cards under the `layer6` bucket because "this creature can't
// block" reads as a static ability — and then found that `canAttack` and
// `canBlock` consulted no static at all, so the engine could not express one
// however the script was written. That is what `CombatDef` is.
describe('a combat restriction from a card script', () => {
  const THUG = 'Spineless Thug';
  const BEARS = 'Grizzly Bears';

  /** p1 attacking with Bears; p2 holding a Thug and a Bears to block with. */
  function inCombat(scripts = createRegistry([SPINELESS_THUG_SCRIPT])) {
    const game = startedGame({
      players: 2,
      decks: [[BEARS], [THUG, BEARS]],
      scripts,
      startingPlayer: 'p1',
    });
    holdEverywhere(game);
    const attacker = put(game, 'p1', BEARS);
    const thug = put(game, 'p2', THUG);
    const theirBears = put(game, 'p2', BEARS);
    // Past summoning sickness, and into a combat where p1 is the attacker.
    advanceUntil(game, (s) => s.turn.turnNumber >= 3 && s.turn.step === 'declareAttackers', 40_000);
    return { game, attacker, thug, theirBears };
  }

  test('the restricted creature cannot block, and the untouched one can', () => {
    const { game, attacker, thug, theirBears } = inCombat();
    must(
      game.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: attacker, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    const deps = { state: game.state, oracle: game.deps.oracle, scripts: game.deps.scripts };
    // ⚠️ BOTH DIRECTIONS IN ONE CHECK. A def that refused every blocker would
    // pass the first assertion on its own — and refusing everything is exactly
    // what this script does if it forgets to compare against `self`.
    expect(canBlock(deps, thug, attacker)).toBe('restricted');
    expect(canBlock(deps, theirBears, attacker)).toBeNull();
  });

  test('with no script registered the same creature blocks fine', () => {
    // ⚠️ THE BREAK TEST IN THE SUITE, and it is the one that matters: with
    // `NO_SCRIPTS` — what the app ships — nothing must change. A seam that
    // altered combat with no scripts loaded would be a rules regression on
    // every game anyone has ever played.
    const { game, attacker, thug } = inCombat(NO_SCRIPTS);
    must(
      game.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: attacker, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    const deps = { state: game.state, oracle: game.deps.oracle, scripts: game.deps.scripts };
    expect(canBlock(deps, thug, attacker)).toBeNull();
  });
});

// ── the chosen colour (CR 614.12) ────────────────────────────────────────────
//
// ⚠️ D136 measured the "as ~ enters, choose" family at 162 cards and said the
// FIELD is the primitive rather than the question — "building the question alone
// asks the player something that does nothing". Right, and it is why only the
// COLOUR shape is built: it is the one with a consumer the engine already has,
// `{T}: Add one mana of the chosen color`. `Sol Grail` is the whole card in two
// lines and needs no card script at all.
describe('naming a colour as a permanent enters', () => {
  const GRAIL = 'Sol Grail';

  function entering(): { game: Game; grail: string } {
    const game = startedGame({ players: 2, decks: [[GRAIL]] });
    holdEverywhere(game);
    const grail = put(game, 'p1', GRAIL);
    return { game, grail };
  }

  test('it stops and asks — with the permanent already on the battlefield', () => {
    const { game, grail } = entering();
    const a = game.state.priority.awaiting;
    expect(a?.kind).toBe('chooseColor');
    if (a?.kind !== 'chooseColor') throw new Error('unreachable');
    expect(a.player).toBe('p1');
    expect(a.source).toBe(grail);
    expect(a.label).toBe(GRAIL);
    // ⚠️ Same shape as D136's pay-to-enter: `applyReplacements` is pure and
    // cannot suspend, so the permanent has entered while the question is up.
    expect(game.state.cards[grail]?.zone.kind).toBe('battlefield');
    expect(game.state.cards[grail]?.chosenColor).toBeNull();
  });

  test('answering is remembered on the object, not spent', () => {
    const { game, grail } = entering();
    must(game.submit({ t: 'AnswerChooseColor', player: 'p1', color: 'U' }));
    expect(game.state.cards[grail]?.chosenColor).toBe('U');
    expect(game.state.priority.awaiting).toBeNull();
  });

  /**
   * ⚠️ **THE ASSERTION THAT MAKES THE FIELD WORTH HAVING.** Without a consumer
   * this is a stored answer nothing reads. `manaSourcesOf` scopes the Grail's
   * mana ability to `chosenColor`, so what it offers changes with the answer.
   */
  test('and the mana ability then makes exactly that colour', () => {
    const { game, grail } = entering();
    must(game.submit({ t: 'AnswerChooseColor', player: 'p1', color: 'R' }));
    const sources = manaSourcesOf(game.state, game.deps.oracle, game.deps.scripts, 'p1', {
      includeConditional: true,
    });
    const grailSource = sources.find((s) => s.card === grail);
    expect(grailSource).toBeDefined();
    expect(grailSource?.outputs.map((o) => costStringOf(o.mana))).toEqual(['{R}']);
  });

  test('before it is answered the source offers nothing at all', () => {
    // ⚠️ Not "any colour" and not "colourless" — the card says the chosen
    // colour, and until one is chosen there is no such colour. Offering five
    // would be the engine making the choice.
    const { game, grail } = entering();
    const sources = manaSourcesOf(game.state, game.deps.oracle, game.deps.scripts, 'p1', {
      includeConditional: true,
    });
    expect(sources.some((s) => s.card === grail)).toBe(false);
  });

  test('leaving the battlefield forgets it, so it is asked again (CR 400.7)', () => {
    const { game, grail } = entering();
    must(game.submit({ t: 'AnswerChooseColor', player: 'p1', color: 'G' }));
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: grail, to: { kind: 'hand', player: 'p1' } }));
    expect(game.state.cards[grail]?.chosenColor).toBeNull();
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: grail, to: { kind: 'battlefield', player: 'p1' } }));
    expect(game.state.priority.awaiting?.kind).toBe('chooseColor');
  });

  test('the whole card is engine-complete, with no script anywhere', () => {
    // Two lines, both run: the question and the mana ability that reads it.
    const card = ORACLE.byName(GRAIL);
    expect(card).toBeDefined();
    if (!card) return;
    expect(engineCompleteness(card.data).complete).toBe(true);
  });

  test('it replays to the same state', () => {
    const { game } = entering();
    must(game.submit({ t: 'AnswerChooseColor', player: 'p1', color: 'B' }));
    // `chosenColor` is part of `GameState`, and so of the state hash.
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });
});
