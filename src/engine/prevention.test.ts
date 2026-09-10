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

const P1 = ['Grizzly Bears', 'Fog', 'Lightning Bolt', 'Lightning Bolt', 'Mending Hands', 'Indestructible Aura', 'Pinpoint Avalanche'];

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

  test('the shield is a THIS TURN effect: cleanup clears it, and the game replays', () => {
    const { g } = armed();
    cast(g, 'Mending Hands', ['W'], [{ kind: 'player', id: 'p1' }]);
    expect(g.state.preventionShields.length).toBe(1);
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 20_000);
    expect(g.state.preventionShields.length).toBe(0);
    expect(stateHash(replay(g.log))).toBe(stateHash(g.state));
  });
});
