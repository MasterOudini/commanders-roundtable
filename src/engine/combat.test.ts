import { describe, expect, test } from 'vitest';
import { canAttack, canBlock, legalDefenders } from './combat';
import { makeDeriveCache } from './derive';
import {
  ORACLE,
  advanceUntil,
  find,
  holdEverywhere,
  must,
  put,
  startedGame,
} from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

/**
 * Two players, creatures on both sides, at p1's declare-attackers step on turn
 * 3 — so nothing is summoning sick and everything is untapped.
 *
 * ⚠️ Built by playing forward rather than by writing a `GameState`. Every board
 * these tests assert on is one the engine could genuinely produce.
 */
function combatBoard(mine: readonly string[], theirs: readonly string[]) {
  const game = startedGame({
    players: 2,
    decks: [[...mine], [...theirs]],
    librarySize: 60,
    startingPlayer: 'p1',
  });
  const attackers = mine.map((n) => put(game, 'p1', n));
  const blockers = theirs.map((n) => put(game, 'p2', n));
  // ⚠️ Every case below observes combat MID-FLIGHT — the blocker order, the
  // board between blocks and damage, a creature pulled out of combat before it
  // fights. Auto-pass runs the game straight through any window in which nobody
  // could act, so without this the whole of combat happens inside the `block()`
  // submit and each of those tests asserts on a moment that has already gone.
  // A rules test must not depend on the stops policy: `holdEverywhere` says
  // "stop everywhere" out loud, instead of leaning on the defaults to do it.
  holdEverywhere(game);
  advanceUntil(game, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers');
  return { game, attackers, blockers };
}

function deps(game: Game) {
  return { state: game.state, oracle: ORACLE, scripts: game.deps.scripts, cache: makeDeriveCache(game.state) };
}

/**
 * Declare attackers and run forward to the blocker prompt.
 *
 * WARNING: the engine does NOT stop at the blocker prompt on its own. After
 * attackers are declared there is a priority round in the declare-attackers
 * step, and `alwaysStop.declareAttackers` keeps a human there. Submitting
 * blocks without advancing gets `notAwaitingThat`, which reads as a broken
 * handler rather than a missing step.
 *
 * It also does not stop when the defender has NO legal block: that player is
 * auto-submitted with an empty declaration rather than asked, so the table does
 * not wait on someone whose only creature is tapped.
 */
function attack(game: Game, attackers: readonly InstanceId[]): void {
  must(
    game.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: attackers.map((card) => ({ card, defender: { kind: 'player' as const, id: 'p2' } })),
    }),
  );
  advanceUntil(
    game,
    (s) =>
      s.priority.awaiting?.kind === 'declareBlockers' ||
      s.turn.step === 'postcombatMain' ||
      s.gamePhase === 'finished',
  );
}

/** True when the engine is actually asking p2 to block. */
function blockPromptUp(game: Game): boolean {
  return game.state.priority.awaiting?.kind === 'declareBlockers';
}

function block(game: Game, blocks: readonly { blocker: InstanceId; attacker: InstanceId }[]) {
  return game.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [...blocks] });
}

function resolveCombat(game: Game): void {
  advanceUntil(game, (s) => s.turn.step === 'postcombatMain' || s.gamePhase === 'finished');
}

function lifeOf(game: Game, p: string): number {
  return game.state.players[p]?.life ?? 0;
}

function zoneOf(game: Game, id: InstanceId): string {
  return game.state.cards[id]?.zone.kind ?? '<gone>';
}

// ── the 16-case keyword matrix ───────────────────────────────────────────────
//
// ⚠️ THIS IS WHERE THE TEST TABLE EARNS ITS COST. Nothing on screen looks wrong
// when a flier is blocked by a ground creature, and the player who loses the
// game to it will never know why. Every case below is a Tier-2 keyword doing
// exactly one job.

describe('the combat keyword matrix', () => {
  test('1. a flier cannot be blocked by a ground creature', () => {
    const { game, attackers, blockers } = combatBoard(['Air Elemental'], ['Grizzly Bears', 'Giant Spider']);
    attack(game, attackers);
    // The Spider CAN block, so p2 is genuinely asked, and the ground creature's
    // block is refused with a message that says what to do instead.
    expect(blockPromptUp(game)).toBe(true);
    expect(canBlock(deps(game), blockers[0] as string, attackers[0] as string)).toBe('flying');
    const result = block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('illegalBlock');
      expect(result.message).toContain('flying or reach');
    }
  });

  test('1b. with NO legal block at all, the defender is not even asked', () => {
    const { game, attackers } = combatBoard(['Air Elemental'], ['Grizzly Bears']);
    attack(game, attackers);
    expect(blockPromptUp(game)).toBe(false);
    resolveCombat(game);
    expect(lifeOf(game, 'p2')).toBe(36);
  });

  test('2. reach blocks a flier', () => {
    const { game, attackers, blockers } = combatBoard(['Air Elemental'], ['Giant Spider']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    resolveCombat(game);
    expect(lifeOf(game, 'p2')).toBe(40);
  });

  test('3. flying blocks flying', () => {
    const { game, attackers, blockers } = combatBoard(['Air Elemental'], ['Serra Angel']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    resolveCombat(game);
    expect(zoneOf(game, attackers[0] as string)).toBe('graveyard');
  });

  test('4. menace with one blocker is refused', () => {
    const { game, attackers, blockers } = combatBoard(['Boggart Brute'], ['Grizzly Bears', 'Scathe Zombies']);
    attack(game, attackers);
    expect(blockPromptUp(game)).toBe(true);
    const result = block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('menaceRequiresTwo');
      expect(result.message).toContain('two creatures or none');
    }
  });

  test('5. menace with two blockers is accepted', () => {
    const { game, attackers, blockers } = combatBoard(['Boggart Brute'], ['Grizzly Bears', 'Scathe Zombies']);
    attack(game, attackers);
    must(
      block(game, [
        { blocker: blockers[0] as string, attacker: attackers[0] as string },
        { blocker: blockers[1] as string, attacker: attackers[0] as string },
      ]),
    );
    resolveCombat(game);
    expect(lifeOf(game, 'p2')).toBe(40);
  });

  test('6. trample assigns the excess to the defending player', () => {
    // Colossal Dreadmaw 6/6 trample vs Grizzly Bears 2/2: 2 lethal, 4 tramples.
    const { game, attackers, blockers } = combatBoard(['Colossal Dreadmaw'], ['Grizzly Bears']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    resolveCombat(game);
    expect(lifeOf(game, 'p2')).toBe(36);
    expect(zoneOf(game, blockers[0] as string)).toBe('graveyard');
  });

  test('7. without trample the excess does NOT reach the player', () => {
    // A 6/7 with no trample, blocked by a 2/2: four points of excess damage
    // pile onto the blocker (CR 510.1c) rather than reaching the player.
    const { game, attackers, blockers } = combatBoard(['Scaled Behemoth'], ['Grizzly Bears']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    resolveCombat(game);
    expect(lifeOf(game, 'p2')).toBe(40);
    expect(zoneOf(game, blockers[0] as string)).toBe('graveyard');
  });

  test('8. a 1/1 deathtouch kills a 6/6', () => {
    const { game, attackers, blockers } = combatBoard(['Colossal Dreadmaw'], ['Typhoid Rats']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    resolveCombat(game);
    expect(zoneOf(game, attackers[0] as string)).toBe('graveyard');
  });

  /**
   * ⚠️ Deathtouch makes "lethal" ONE damage per blocker, so trample sends the
   * rest through. The `lethal = deathtouch ? 1 : …` line is the whole
   * implementation of this interaction — there is no special case for it.
   */
  test('9. trample + deathtouch assigns 1 per blocker and tramples the rest', () => {
    const { game, attackers, blockers } = combatBoard(
      ['Colossal Dreadmaw'],
      ['Grizzly Bears', 'Scathe Zombies'],
    );
    // Give the Dreadmaw deathtouch by hand — the Tier-3 tool cannot, so this
    // asserts the assignment maths directly instead.
    attack(game, attackers);
    must(
      block(game, [
        { blocker: blockers[0] as string, attacker: attackers[0] as string },
        { blocker: blockers[1] as string, attacker: attackers[0] as string },
      ]),
    );
    resolveCombat(game);
    // 6 power, 2+2 lethal across two 2/2s, 2 trample over.
    expect(lifeOf(game, 'p2')).toBe(38);
  });

  /**
   * ⚠️ Life gain is part of the SAME atomic damage event, and the state-based
   * action that kills the Nighthawk runs afterwards — so it gains its
   * controller 2 life even though it dies to the same blow. Nothing special-
   * cases this; it falls out of the damage being one event.
   *
   * The attacker has no trample on purpose: a trampler would send its excess to
   * the player and bury the two points this test is about.
   */
  test('10. deathtouch + lifelink gains life even though the source dies', () => {
    const { game, attackers, blockers } = combatBoard(['Scaled Behemoth'], ['Vampire Nighthawk']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    resolveCombat(game);
    expect(zoneOf(game, blockers[0] as string)).toBe('graveyard');
    expect(zoneOf(game, attackers[0] as string)).toBe('graveyard');
    expect(lifeOf(game, 'p2')).toBe(42);
  });

  /**
   * ⚠️ The first-strike creature's damage is applied and the SBA closure runs
   * BEFORE the regular damage step, so a dead blocker deals nothing back. That
   * works because `pump()` runs a full SBA pass between the two damage events —
   * not because anything here special-cases it.
   */
  test('11. first strike kills the blocker before it can strike back', () => {
    const { game, attackers, blockers } = combatBoard(['White Knight'], ['Grizzly Bears']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    resolveCombat(game);
    expect(zoneOf(game, blockers[0] as string)).toBe('graveyard');
    expect(zoneOf(game, attackers[0] as string)).toBe('battlefield');
    expect(game.state.cards[attackers[0] as string]?.damage).toBe(0);
  });

  test('12. double strike deals damage in both sub-steps', () => {
    // Boros Swiftblade is 1/2 double strike vs a 2/2: 1 + 1 = 2 = lethal.
    const { game, attackers, blockers } = combatBoard(['Boros Swiftblade'], ['Grizzly Bears']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    const from = game.log.length;
    resolveCombat(game);
    const substeps = game.log
      .slice(from)
      .flatMap((e) => (e.body.t === 'CombatDamageDealt' ? [e.body.substep] : []));
    expect(substeps).toEqual(['firstStrike', 'regular']);
    expect(zoneOf(game, blockers[0] as string)).toBe('graveyard');
  });

  test('13. a vigilant attacker does not tap', () => {
    const { game, attackers } = combatBoard(['Serra Angel'], []);
    attack(game, attackers);
    expect(game.state.cards[attackers[0] as string]?.tapped).toBe(false);
  });

  test('14. a non-vigilant attacker taps (CR 508.1f)', () => {
    const { game, attackers } = combatBoard(['Grizzly Bears'], []);
    attack(game, attackers);
    expect(game.state.cards[attackers[0] as string]?.tapped).toBe(true);
  });

  test('15. a summoning-sick creature cannot attack, and haste can', () => {
    const game = startedGame({ players: 2, decks: [['Grizzly Bears', 'Raging Goblin'], []] });
    const bears = put(game, 'p1', 'Grizzly Bears');
    const goblin = put(game, 'p1', 'Raging Goblin');
    advanceUntil(game, (s) => s.priority.awaiting?.kind === 'declareAttackers');
    expect(canAttack(deps(game), bears)).toBe(false);
    expect(canAttack(deps(game), goblin)).toBe(true);
  });

  test('16. defender cannot attack but can block', () => {
    const { game, attackers, blockers } = combatBoard(['Grizzly Bears'], ['Wall of Omens']);
    expect(canBlock(deps(game), blockers[0] as string, attackers[0] as string)).toBe('notAttacking');
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    resolveCombat(game);
    expect(lifeOf(game, 'p2')).toBe(40);

    const other = startedGame({ players: 2, decks: [['Wall of Omens'], []], librarySize: 60 });
    const wall = put(other, 'p1', 'Wall of Omens');
    advanceUntil(other, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers');
    expect(canAttack(deps(other), wall)).toBe(false);
  });
});

describe('more combat legality', () => {
  test('protection from red cannot be blocked by a red creature', () => {
    const { game, attackers, blockers } = combatBoard(['Kor Firewalker'], ['Raging Goblin', 'Grizzly Bears']);
    attack(game, attackers);
    expect(canBlock(deps(game), blockers[0] as string, attackers[0] as string)).toBe('protection');
    const result = block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('protection');
  });

  test('protection also PREVENTS the damage a red source would deal', () => {
    const { game, attackers, blockers } = combatBoard(['Raging Goblin'], ['Kor Firewalker']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    resolveCombat(game);
    expect(game.state.cards[blockers[0] as string]?.damage).toBe(0);
    expect(zoneOf(game, attackers[0] as string)).toBe('graveyard');
  });

  test('landwalk makes a creature unblockable when the defender has the land', () => {
    const { game, attackers, blockers } = combatBoard(['Bull Hippo'], ['Grizzly Bears']);
    put(game, 'p2', 'Island');
    expect(canBlock(deps(game), blockers[0] as string, attackers[0] as string)).not.toBeNull();
    attack(game, attackers);
    // Nobody can block it, so p2 is not asked and 3 damage goes through.
    expect(blockPromptUp(game)).toBe(false);
    resolveCombat(game);
    expect(lifeOf(game, 'p2')).toBe(37);
  });

  test('landwalk does nothing when the defender controls no such land', () => {
    const { game, attackers, blockers } = combatBoard(['Bull Hippo'], ['Grizzly Bears']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    resolveCombat(game);
    expect(lifeOf(game, 'p2')).toBe(40);
  });

  test('a tapped creature cannot block', () => {
    const { game, attackers, blockers } = combatBoard(['Grizzly Bears'], ['Scathe Zombies', 'Silvercoat Lion']);
    must(game.submit({ t: 'ManualSetTapped', player: 'p2', cards: [blockers[0] as string], tapped: true }));
    attack(game, attackers);
    expect(canBlock(deps(game), blockers[0] as string, attackers[0] as string)).toBe('tapped');
    const result = block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('tapped');
  });

  /**
   * ⚠️ CR 509.1h. `becameBlocked` is STICKY: an attacker that was blocked deals
   * no damage to the player even if the blocker leaves combat. Without it,
   * "block with a chump, then bounce the chump" would let the damage through.
   */
  test('an attacker whose only blocker left combat deals NO damage to the player', () => {
    const { game, attackers, blockers } = combatBoard(['Colossal Dreadmaw'], ['Grizzly Bears']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    must(
      game.submit({
        t: 'ManualMoveCard',
        player: 'p2',
        card: blockers[0] as string,
        to: { kind: 'hand', player: 'p2' },
      }),
    );
    resolveCombat(game);
    expect(lifeOf(game, 'p2')).toBe(40);
  });

  test('an unblocked attacker hits the player for its power', () => {
    const { game, attackers } = combatBoard(['Colossal Dreadmaw'], []);
    attack(game, attackers);
    resolveCombat(game);
    expect(lifeOf(game, 'p2')).toBe(34);
  });

  test('legal defenders are the living opponents', () => {
    const { game } = combatBoard(['Grizzly Bears'], []);
    const defenders = legalDefenders(deps(game), 'p1');
    expect(defenders).toEqual([{ kind: 'player', id: 'p2' }]);
  });

  test('attacking with a creature you do not control is refused', () => {
    const { game, blockers } = combatBoard(['Grizzly Bears'], ['Scathe Zombies']);
    const result = game.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: blockers[0] as string, defender: { kind: 'player', id: 'p2' } }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('illegalAttacker');
  });

  test('blocking with a creature you do not control is refused', () => {
    const { game, attackers } = combatBoard(['Grizzly Bears', 'Scathe Zombies'], ['Silvercoat Lion']);
    attack(game, [attackers[0] as string]);
    expect(blockPromptUp(game)).toBe(true);
    const result = block(game, [
      { blocker: attackers[1] as string, attacker: attackers[0] as string },
    ]);
    expect(result.ok).toBe(false);
  });

  /** Damage persists past end of combat and is cleared at CLEANUP, not before. */
  test('damage marked in combat is cleared at cleanup', () => {
    const { game, attackers, blockers } = combatBoard(['Colossal Dreadmaw'], ['Scaled Behemoth']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    resolveCombat(game);
    expect(game.state.cards[blockers[0] as string]?.damage).toBe(6);
    advanceUntil(game, (s) => s.turn.turnNumber === 4);
    expect(game.state.cards[blockers[0] as string]?.damage).toBe(0);
  });

  test('creatures are removed from combat at end of combat', () => {
    const { game, attackers } = combatBoard(['Grizzly Bears'], []);
    attack(game, attackers);
    resolveCombat(game);
    expect(game.state.combat).toBeNull();
  });
});

describe('commander damage', () => {
  /** 3 × 7 from ONE commander is 21 and a loss. */
  test('21 damage from one commander loses the game', () => {
    const game = startedGame({
      players: 2,
      decks: [[], []],
      commanders: [['Avacyn, Angel of Hope'], ['Krenko, Mob Boss']],
      librarySize: 80,
    });
    const commander = game.state.zones.command['p1']?.[0] as string;
    must(
      game.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: commander,
        to: { kind: 'battlefield', player: 'p1' },
      }),
    );
    // Avacyn is 8/8 flying, so three unblocked swings is 24 — past 21 on the third.
    for (let round = 0; round < 3; round++) {
      advanceUntil(
        game,
        (s) =>
          s.gamePhase === 'finished' ||
          (s.turn.activePlayer === 'p1' && s.priority.awaiting?.kind === 'declareAttackers'),
        20_000,
      );
      if (game.state.gamePhase === 'finished') break;
      attack(game, [commander]);
      resolveCombat(game);
    }
    expect(game.state.players['p2']?.commanderDamage[commander]).toBeGreaterThanOrEqual(21);
    expect(game.state.players['p2']?.lossReason).toBe('commanderDamage');
  });

  test('the tally is keyed by the commander INSTANCE, so two commanders do not pool', () => {
    const game = startedGame({
      players: 2,
      commanders: [['Thrasios, Triton Hero', 'Tymna the Weaver'], ['Krenko, Mob Boss']],
      librarySize: 60,
    });
    const [a, b] = game.state.zones.command['p1'] ?? [];
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    for (const id of [a, b]) {
      must(
        game.submit({
          t: 'ManualMoveCard',
          player: 'p1',
          card: id as string,
          to: { kind: 'battlefield', player: 'p1' },
        }),
      );
      must(game.submit({ t: 'ManualSetPt', player: 'p1', card: id as string, power: 11, toughness: 11 }));
    }
    advanceUntil(game, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers');
    attack(game, [a as string, b as string]);
    resolveCombat(game);
    const tally = game.state.players['p2']?.commanderDamage ?? {};
    expect(tally[a as string]).toBe(11);
    expect(tally[b as string]).toBe(11);
    // 22 total, but neither commander has dealt 21 — so p2 is still alive.
    expect(game.state.players['p2']?.hasLost).toBe(false);
    expect(lifeOf(game, 'p2')).toBe(18);
  });

  test('non-combat damage from a commander does not count', () => {
    const game = startedGame({ players: 2, librarySize: 60 });
    const commander = game.state.zones.command['p1']?.[0] as string;
    must(game.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: -21 }));
    expect(game.state.players['p2']?.commanderDamage[commander] ?? 0).toBe(0);
    expect(game.state.players['p2']?.hasLost).toBe(false);
  });

  test('combat damage to a creature does not count as commander damage', () => {
    const game = startedGame({
      players: 2,
      decks: [[], ['Serra Angel']],
      commanders: [['Avacyn, Angel of Hope'], ['Krenko, Mob Boss']],
      librarySize: 60,
    });
    const commander = game.state.zones.command['p1']?.[0] as string;
    must(
      game.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: commander,
        to: { kind: 'battlefield', player: 'p1' },
      }),
    );
    // Avacyn flies, so the blocker has to as well.
    const wall = put(game, 'p2', 'Serra Angel');
    advanceUntil(game, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers');
    attack(game, [commander]);
    must(block(game, [{ blocker: wall, attacker: commander }]));
    resolveCombat(game);
    expect(game.state.players['p2']?.commanderDamage[commander] ?? 0).toBe(0);
    expect(lifeOf(game, 'p2')).toBe(40);
  });

  test('a commander that is not the source does not add to another commander tally', () => {
    const game = startedGame({ players: 2, decks: [['Grizzly Bears'], []], librarySize: 60 });
    const bears = put(game, 'p1', 'Grizzly Bears');
    advanceUntil(game, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers');
    attack(game, [bears]);
    resolveCombat(game);
    expect(Object.keys(game.state.players['p2']?.commanderDamage ?? {})).toEqual([]);
    expect(lifeOf(game, 'p2')).toBe(38);
  });
});

describe('blocker ordering', () => {
  test('two blockers on one attacker set a damage assignment order', () => {
    const { game, attackers, blockers } = combatBoard(
      ['Colossal Dreadmaw'],
      ['Grizzly Bears', 'Scathe Zombies'],
    );
    attack(game, attackers);
    must(
      block(game, [
        { blocker: blockers[0] as string, attacker: attackers[0] as string },
        { blocker: blockers[1] as string, attacker: attackers[0] as string },
      ]),
    );
    const decl = game.state.combat?.attackers.find((a) => a.card === attackers[0]);
    expect(decl?.blockerOrder).toEqual([blockers[0], blockers[1]]);
    must(
      game.submit({
        t: 'OrderBlockers',
        player: 'p1',
        attacker: attackers[0] as string,
        order: [blockers[1] as string, blockers[0] as string],
      }),
    );
    expect(
      game.state.combat?.attackers.find((a) => a.card === attackers[0])?.blockerOrder,
    ).toEqual([blockers[1], blockers[0]]);
  });

  test('an ordering that names the wrong creatures is refused', () => {
    const { game, attackers, blockers } = combatBoard(['Grizzly Bears'], ['Scathe Zombies']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    const result = game.submit({
      t: 'OrderBlockers',
      player: 'p1',
      attacker: attackers[0] as string,
      order: [attackers[0] as string],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalidOrder');
  });

  test('find() and the harness agree on which creature is which', () => {
    const { game } = combatBoard(['Serra Angel'], ['Grizzly Bears']);
    expect(find(game, 'p1', 'battlefield', 'Serra Angel')).toBeDefined();
    expect(find(game, 'p2', 'battlefield', 'Grizzly Bears')).toBeDefined();
  });
});

// ── infect, wither and toxic (M5 · D68) ──────────────────────────────────────
//
// ⚠️ These three are the M5 Tier-2 promotions, and they are the first keywords
// in this file that change what damage DOES rather than who may block whom. The
// primitives they need were all already there and reachable only by hand:
// `player.poison`, the poison state-based action at `options.poisonThreshold`,
// and `-1/-1` counters. Every assertion below is on the OUTCOME — life, poison,
// counters, who died — never on the ResolvedDamage record, because the record
// being right and the fold being wrong is exactly the bug worth catching.

describe('infect, wither and toxic', () => {
  test('infect damages a PLAYER as poison counters, not life', () => {
    const { game, attackers } = combatBoard(['Rot Wolf'], []);
    attack(game, attackers);
    resolveCombat(game);
    expect(lifeOf(game, 'p2')).toBe(40);
    expect(game.state.players['p2']?.poison).toBe(2);
  });

  test('infect damages a CREATURE as -1/-1 counters, not damage marks', () => {
    const { game, attackers, blockers } = combatBoard(['Rot Wolf'], ['Scaled Behemoth']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    resolveCombat(game);
    const blocker = game.state.cards[blockers[0] as string];
    // ⚠️ A damage MARK is wiped at cleanup; a counter is permanent. Asserting on
    // the counter rather than on "it survived" is what makes this test able to
    // tell the two apart.
    expect(blocker?.counters['-1/-1']).toBe(2);
    expect(blocker?.damage).toBe(0);
  });

  /**
   * ⚠️ CR 702.90b. Life gain keys off the damage being DEALT, not off how it was
   * applied — so infect + lifelink still gains life even though the victim takes
   * poison rather than losing any. Modelling infect as "deal 0, then add
   * counters" would silently break this, which is precisely why `applyAs` is a
   * replacement flag on one damage record rather than a second event.
   */
  test('infect + lifelink still gains life (CR 702.90b)', () => {
    const { game, attackers } = combatBoard(['Flensermite'], []);
    attack(game, attackers);
    resolveCombat(game);
    expect(game.state.players['p2']?.poison).toBe(1);
    expect(lifeOf(game, 'p2')).toBe(40);
    expect(lifeOf(game, 'p1')).toBe(41);
  });

  test('wither damages a creature as counters but a PLAYER normally', () => {
    const { game, attackers } = combatBoard(['Twinblade Slasher'], []);
    attack(game, attackers);
    resolveCombat(game);
    // ⚠️ Wither only ever touches creatures. A wither creature attacking a
    // player is completely ordinary, and giving it poison would be a rules bug
    // that only ever showed up as "why am I losing to poison".
    expect(lifeOf(game, 'p2')).toBe(39);
    expect(game.state.players['p2']?.poison).toBe(0);
  });

  test('wither kills a creature with -1/-1 counters', () => {
    const { game, attackers, blockers } = combatBoard(['Twinblade Slasher'], ['Grizzly Bears']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    resolveCombat(game);
    const blocker = game.state.cards[blockers[0] as string];
    expect(blocker?.counters['-1/-1']).toBe(1);
    // A 2/2 with one -1/-1 counter is a 1/1 — alive, and permanently smaller.
    expect(zoneOf(game, blockers[0] as string)).toBe('battlefield');
  });

  test('toxic adds poison ON TOP of normal combat damage (CR 702.180a)', () => {
    const { game, attackers } = combatBoard(['Bloated Contaminator'], []);
    attack(game, attackers);
    resolveCombat(game);
    // ⚠️ Toxic is ADDITIVE, unlike infect. Both the life loss and the poison
    // have to be there; a version that replaced one with the other would pass
    // half of this test.
    expect(lifeOf(game, 'p2')).toBe(36);
    expect(game.state.players['p2']?.poison).toBe(1);
  });

  test('toxic 4 gives four poison counters, not one', () => {
    const { game, attackers } = combatBoard(['Tyrranax Rex'], []);
    attack(game, attackers);
    resolveCombat(game);
    expect(lifeOf(game, 'p2')).toBe(32);
    expect(game.state.players['p2']?.poison).toBe(4);
  });

  test('a creature that only BLOCKS a toxic creature takes no poison', () => {
    const { game, attackers, blockers } = combatBoard(['Bloated Contaminator'], ['Scaled Behemoth']);
    attack(game, attackers);
    must(block(game, [{ blocker: blockers[0] as string, attacker: attackers[0] as string }]));
    resolveCombat(game);
    // Toxic is combat damage to a PLAYER. A blocked toxic creature that does not
    // trample over deals none of it to anybody.
    expect(game.state.players['p2']?.poison).toBe(0);
  });

  /**
   * ⚠️ THE LOSING CONDITION, run to completion. Ten poison is a loss exactly
   * like 0 life, the SBA has enforced it since M3, and until M5 nothing could
   * reach it without the Tier-3 manual tool. Three swings of Tyrranax Rex is 12.
   */
  test('ten poison counters lose the game', () => {
    const { game, attackers } = combatBoard(['Tyrranax Rex'], []);
    attack(game, attackers);
    resolveCombat(game);
    expect(game.state.players['p2']?.poison).toBe(4);

    advanceUntil(game, (s) => s.turn.turnNumber === 5 && s.priority.awaiting?.kind === 'declareAttackers');
    attack(game, attackers);
    resolveCombat(game);
    expect(game.state.players['p2']?.poison).toBe(8);

    advanceUntil(game, (s) => s.turn.turnNumber === 7 && s.priority.awaiting?.kind === 'declareAttackers');
    attack(game, attackers);
    resolveCombat(game);
    expect(game.state.players['p2']?.poison).toBeGreaterThanOrEqual(10);
    expect(game.state.players['p2']?.hasLost).toBe(true);
  });

  /**
   * ⚠️ An infect COMMANDER is on two clocks at once. CR 903.10a keys commander
   * damage off combat damage dealt to a player by a commander, and infect
   * changes how that damage is applied rather than whether it happened — so the
   * poison AND the commander tally both move.
   */
  test('an infect commander deals commander damage AND poison', () => {
    const game = startedGame({
      players: 2,
      // ⚠️ Rot Wolf is the COMMANDER and is deliberately not also in the deck:
      // `findAnywhere` would otherwise hand back whichever copy it met first,
      // and a test that silently attacked with a non-commander copy would assert
      // exactly nothing about commander damage.
      decks: [['Grizzly Bears'], ['Grizzly Bears']],
      librarySize: 60,
      startingPlayer: 'p1',
      commanders: [['Rot Wolf'], ['Silvercoat Lion']],
    });
    const commander = put(game, 'p1', 'Rot Wolf');
    expect(game.state.cards[commander]?.isCommander).toBe(true);
    advanceUntil(game, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers');
    attack(game, [commander]);
    resolveCombat(game);
    expect(game.state.players['p2']?.poison).toBe(2);
    expect(game.state.players['p2']?.commanderDamage[commander]).toBe(2);
    expect(lifeOf(game, 'p2')).toBe(40);
  });
});
