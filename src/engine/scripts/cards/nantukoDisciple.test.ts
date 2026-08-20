// `Nantuko Disciple` — {G}, {T}: the pump lands and the Disciple turns.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NANTUKO_DISCIPLE_SCRIPT } from './nantukoDisciple';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function taught(): { g: Game; disciple: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Nantuko Disciple', 'Grizzly Bears'], []],
    scripts: createRegistry([NANTUKO_DISCIPLE_SCRIPT]),
  });
  const disciple = put(g, 'p1', 'Nantuko Disciple');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  return { g, disciple, bears };
}

describe('Nantuko Disciple', () => {
  test('the pump lands and the Disciple turns', () => {
    const { g, disciple, bears } = taught();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: disciple,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(4);
    expect(d.toughness).toBe(4);
    expect(g.state.cards[disciple]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, disciple, bears } = taught();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: disciple,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
