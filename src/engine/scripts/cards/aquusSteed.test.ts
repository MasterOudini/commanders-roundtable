// `Aquus Steed` — a targeted -2/-0 through layer 7c; lean twin of the pumps.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AQUUS_STEED_SCRIPT } from './aquusSteed';
import { ORACLE, advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Aquus Steed', () => {
  test('shrinks the target’s power and replays', () => {
    const g = startedGame({
      players: 2,
      decks: [['Aquus Steed'], ['Serra Angel']],
      scripts: createRegistry([AQUUS_STEED_SCRIPT]),
    });
    const steed = put(g, 'p1', 'Aquus Steed');
    const angel = put(g, 'p2', 'Serra Angel');
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: steed,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: angel }],
      }),
    );
    settle(g);
    const d = deps(createRegistry([AQUUS_STEED_SCRIPT]));
    expect(derive(g.state, ORACLE, d.scripts, angel).power).toBe(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
