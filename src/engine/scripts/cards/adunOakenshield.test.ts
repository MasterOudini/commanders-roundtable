// `Adun Oakenshield` — the first activated graveyard return, with D138's zone
// and card-type restrictions on the target spec.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ADUN_OAKENSHIELD_SCRIPT } from './adunOakenshield';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ADUN = 'Adun Oakenshield';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[ADUN, 'Grizzly Bears'], []],
    scripts: createRegistry([ADUN_OAKENSHIELD_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Adun Oakenshield', () => {
  test('returns a creature card from the graveyard to its owner’s hand', () => {
    const g = game();
    const adun = put(g, 'p1', ADUN);
    const bears = put(g, 'p1', 'Grizzly Bears', 'graveyard');
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    const handBefore = idsIn(g, 'p1', 'hand').length;
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: adun,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(idsIn(g, 'p1', 'hand').length).toBe(handBefore + 1);
    expect(g.state.cards[adun]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = game();
    const adun = put(g, 'p1', ADUN);
    const bears = put(g, 'p1', 'Grizzly Bears', 'graveyard');
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: adun,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
