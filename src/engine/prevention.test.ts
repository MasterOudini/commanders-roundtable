// D382 - PREVENTION SHIELDS (CR 615). A shield stands between some damage and
// some recipient until this turn ends; the replacement funnel spends it, because
// CR 615.1 says a prevention effect IS a replacement effect and the funnel is
// the ONE place every damage event passes through - which is what makes this
// reach the hundreds of shipped modules that build a `DamageDealt` themselves,
// the gap D233 measured and wrote a tripwire for.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { PINPOINT_AVALANCHE_SCRIPT } from './scripts/cards/pinpointAvalanche';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const P1 = ['Grizzly Bears', 'Fog', 'Lightning Bolt', 'Lightning Bolt', 'Mending Hands', 'Indestructible Aura', 'Pinpoint Avalanche',
  // D427 - the scoped shields' proof spells, and a red 5/2 of p1's own beside the green Bears.
  'Harmless Assault', 'Vine Snare', 'Forfend', 'Fend Off', 'Safe Passage', "Hunter's Ambush", 'Cyclops of One-Eyed Pass'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mana(g: Game, symbols: readonly string[]): void {
  for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W', amount: 1 }));
}

/** p1's third-turn main phase, a Grizzly Bears of p1's on the board, every hold on. */
function armed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [P1, ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([PINPOINT_AVALANCHE_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, bears };
}

function cast(g: Game, name: string, symbols: readonly string[], targets: readonly { kind: 'card' | 'player'; id: string }[] = []): void {
  const card = put(g, 'p1', name, 'hand');
  mana(g, symbols);
  must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: targets as never }));
  settle(g);
}

describe('D382 - the shield goes up and the funnel spends it', () => {
  test('Fog: combat damage is prevented, and the attacker is untouched', () => {
    const { g, bears } = armed();
    const life0 = g.state.players.p2?.life ?? 0;
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
    cast(g, 'Fog', ['G']);
    expect(g.state.preventionShields.length).toBe(1);
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 20_000);
    expect(g.state.players.p2?.life).toBe(life0);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('Fog is COMBAT only: a Lightning Bolt still lands', () => {
    const { g } = armed();
    cast(g, 'Fog', ['G']);
    const life0 = g.state.players.p2?.life ?? 0;
    cast(g, 'Lightning Bolt', ['R'], [{ kind: 'player', id: 'p2' }]);
    expect(g.state.players.p2?.life).toBe(life0 - 3);
  });

  test('Mending Hands: 4 absorbs the first Bolt whole and the second in part', () => {
    const { g } = armed();
    const life0 = g.state.players.p1?.life ?? 0;
    cast(g, 'Mending Hands', ['W'], [{ kind: 'player', id: 'p1' }]);
    cast(g, 'Lightning Bolt', ['R'], [{ kind: 'player', id: 'p1' }]);
    expect(g.state.players.p1?.life).toBe(life0);
    // 1 of the shield is left, so 2 of the next 3 get through.
    cast(g, 'Lightning Bolt', ['R'], [{ kind: 'player', id: 'p1' }]);
    expect(g.state.players.p1?.life).toBe(life0 - 2);
    expect(g.state.preventionShields.length).toBe(0);
  });

  test('Indestructible Aura: all damage to that creature, and to nothing else', () => {
    const { g, bears } = armed();
    const life0 = g.state.players.p2?.life ?? 0;
    cast(g, 'Indestructible Aura', ['W'], [{ kind: 'card', id: bears }]);
    cast(g, 'Lightning Bolt', ['R'], [{ kind: 'card', id: bears }]);
    expect(g.state.cards[bears]?.damage).toBe(0);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    cast(g, 'Lightning Bolt', ['R'], [{ kind: 'player', id: 'p2' }]);
    expect(g.state.players.p2?.life).toBe(life0 - 3);
  });

  test("Pinpoint Avalanche: 'The damage can't be prevented.' goes through the shield", () => {
    const { g, bears } = armed();
    cast(g, 'Indestructible Aura', ['W'], [{ kind: 'card', id: bears }]);
    cast(g, 'Pinpoint Avalanche', ['R', 'R', 'C', 'C', 'C'], [{ kind: 'card', id: bears }]);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    // The shield is still up: nothing was spent on damage it could not touch.
    expect(g.state.preventionShields.length).toBe(1);
  });

  // D427 - THE SHIELD'S SOURCE AND RECIPIENT SCOPES.
  /** p1 attacks p2 with the Bears (green 2/2) and its own Cyclops (red 5/2), casting `name` before damage. */
  function attackUnder(name: string, symbols: readonly string[], targets: readonly { kind: 'card' | 'player'; id: string }[] = []): { g: Game; bears: InstanceId; cy: InstanceId; life0: number } {
    const { g, bears } = armed();
    const cy = put(g, 'p1', 'Cyclops of One-Eyed Pass');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
    const life0 = g.state.players.p2?.life ?? 0;
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }, { card: cy, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
    cast(g, name, symbols, targets.map((t) => (t.id === 'bears' ? { ...t, id: bears } : t.id === 'cy' ? { ...t, id: cy } : t)));
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 20_000);
    return { g, bears, cy, life0 };
  }

  test('Harmless Assault: attacking creatures deal nothing; a Bolt (not attacking, not combat) still lands', () => {
    const { g, life0 } = attackUnder('Harmless Assault', ['W', 'W', 'C', 'C']);
    expect(g.state.players.p2?.life).toBe(life0);
    cast(g, 'Lightning Bolt', ['R'], [{ kind: 'player', id: 'p2' }]);
    expect(g.state.players.p2?.life).toBe(life0 - 3);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Vine Snare: the 2/2 is stopped, the 5/2 is not (power 4 or less)', () => {
    const { g, life0 } = attackUnder('Vine Snare', ['G', 'C', 'C']);
    expect(g.state.players.p2?.life).toBe(life0 - 5);
  });

  test("Hunter's Ambush: the red Cyclops is stopped, the green Bears is not (nongreen creatures)", () => {
    const { g, life0 } = attackUnder("Hunter's Ambush", ['G', 'C', 'C']);
    expect(g.state.players.p2?.life).toBe(life0 - 2);
  });

  test('Fend Off: the targeted Bears deals nothing, the Cyclops deals 5', () => {
    const { g, life0 } = attackUnder('Fend Off', ['W', 'C'], [{ kind: 'card', id: 'bears' }]);
    expect(g.state.players.p2?.life).toBe(life0 - 5);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Forfend: damage to creatures is prevented, damage to players is not', () => {
    const { g, bears } = armed();
    const life0 = g.state.players.p2?.life ?? 0;
    cast(g, 'Forfend', ['W', 'C']);
    cast(g, 'Lightning Bolt', ['R'], [{ kind: 'card', id: bears }]);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.damage ?? 0).toBe(0);
    cast(g, 'Lightning Bolt', ['R'], [{ kind: 'player', id: 'p2' }]);
    expect(g.state.players.p2?.life).toBe(life0 - 3);
  });

  test('Safe Passage: you and your creatures are covered, the opponent is not', () => {
    const { g, bears } = armed();
    const mine = g.state.players.p1?.life ?? 0;
    const theirs = g.state.players.p2?.life ?? 0;
    cast(g, 'Safe Passage', ['W', 'C', 'C']);
    cast(g, 'Lightning Bolt', ['R'], [{ kind: 'card', id: bears }]);
    expect(g.state.cards[bears]?.damage ?? 0).toBe(0);
    cast(g, 'Lightning Bolt', ['R'], [{ kind: 'player', id: 'p1' }]);
    expect(g.state.players.p1?.life).toBe(mine);
    cast(g, 'Mending Hands', ['W'], [{ kind: 'player', id: 'p2' }]);
    expect(g.state.players.p2?.life).toBe(theirs);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the shield is a THIS TURN effect: cleanup clears it, and the game replays', () => {
    const { g } = armed();
    cast(g, 'Mending Hands', ['W'], [{ kind: 'player', id: 'p1' }]);
    expect(g.state.preventionShields.length).toBe(1);
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 20_000);
    expect(g.state.preventionShields.length).toBe(0);
    expect(stateHash(replay(g.log))).toBe(stateHash(g.state));
  });
});
