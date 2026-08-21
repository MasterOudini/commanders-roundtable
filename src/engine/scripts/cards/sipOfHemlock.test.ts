// `Sip of Hemlock` — the destroy with a bill: the controller pays the 2
// whether or not the creature dies (its own sentence).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SIP_OF_HEMLOCK_SCRIPT } from './sipOfHemlock';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sipped(victimName: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Sip of Hemlock'], [victimName]],
    scripts: createRegistry([SIP_OF_HEMLOCK_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Sip of Hemlock', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Sip of Hemlock', () => {
  test('the creature dies and its controller loses 2', () => {
    const { g, victim } = sipped('Grizzly Bears');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('an indestructible creature survives, and the bill still arrives', () => {
    const { g, victim } = sipped('Darksteel Myr');
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const { g } = sipped('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
