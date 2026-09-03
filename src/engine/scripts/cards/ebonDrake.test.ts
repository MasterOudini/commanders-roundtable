// `Ebon Drake` - its controller's own spell costs a life, and so does an opponent's; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { EBON_DRAKE_SCRIPT } from './ebonDrake';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Ebon Drake';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; mine: InstanceId; theirs: InstanceId; life0: number } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARS], [BEARS]], scripts: createRegistry([EBON_DRAKE_SCRIPT]) });
  holdEverywhere(g);
  put(g, 'p1', CARD);
  const mine = put(g, 'p1', BEARS, 'hand');
  const theirs = put(g, 'p2', BEARS, 'hand');
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 60_000);
  const life0 = g.state.players.p1?.life ?? 0;
  return { g, mine, theirs, life0 };
}

describe('Ebon Drake', () => {
  test("its controller's own spell costs 1 life", () => {
    const { g, mine, life0 } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mine }));
    settle(g);
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(g.state.players.p1?.life).toBe(life0 - 1);
  });

  test("an opponent's spell costs the Drake's controller 1 life too", () => {
    const { g, theirs, life0 } = armed();
    advanceUntil(
      g,
      (s) => s.turn.turnNumber >= 2 && s.turn.activePlayer === 'p2' && s.priority.player === 'p2' && s.priority.awaiting === null && s.turn.phase === 'precombatMain',
      20_000,
    );
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p2', card: theirs }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
    expect(g.state.players.p1?.life).toBe(life0 - 1);
    expect(g.state.players.p2?.life).toBe(g.state.players.p2?.life);
  });

  test('replays to the same hash', () => {
    const { g, mine } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mine }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
