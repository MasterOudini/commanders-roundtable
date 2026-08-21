// `Rebuking Ceremony` — two artifacts go home on top.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { REBUKING_CEREMONY_SCRIPT } from './rebukingCeremony';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rebuked(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Rebuking Ceremony', 'Sol Ring'], ['Mind Stone']],
    scripts: createRegistry([REBUKING_CEREMONY_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Sol Ring');
  const theirs = put(g, 'p2', 'Mind Stone');
  settle(g);
  const spell = put(g, 'p1', 'Rebuking Ceremony', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [
        { kind: 'card', id: mine },
        { kind: 'card', id: theirs },
      ],
    }),
  );
  settle(g);
  return { g, mine, theirs };
}

describe('Rebuking Ceremony', () => {
  test('each artifact sits on top of its OWN owner library', () => {
    const { g, mine, theirs } = rebuked();
    const p1Lib = g.state.zones.library['p1'] ?? [];
    const p2Lib = g.state.zones.library['p2'] ?? [];
    expect(p1Lib[p1Lib.length - 1]).toBe(mine);
    expect(p2Lib[p2Lib.length - 1]).toBe(theirs);
  });

  test('replays to the same hash', () => {
    const { g } = rebuked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
