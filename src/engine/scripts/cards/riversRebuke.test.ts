// `River's Rebuke` — the target's nonland board goes home; their land
// and my board stay.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RIVERS_REBUKE_SCRIPT } from './riversRebuke';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rebuked(): { g: Game; bears: InstanceId; land: InstanceId; drake: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ["River's Rebuke", 'Muse Drake'],
      ['Grizzly Bears', 'Mountain'],
    ],
    scripts: createRegistry([RIVERS_REBUKE_SCRIPT]),
  });
  const drake = put(g, 'p1', 'Muse Drake');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "River's Rebuke", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, bears, land, drake };
}

describe("River's Rebuke", () => {
  test('their creature goes to hand; their land and my creature stay', () => {
    const { g, bears, land, drake } = rebuked();
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(g.state.cards[land]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[drake]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = rebuked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
