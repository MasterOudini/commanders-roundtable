// `Orcish Bloodpainter` — the creature chooser pays and the ping lands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ORCISH_BLOODPAINTER_SCRIPT } from './orcishBloodpainter';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function painted(): { g: Game; painter: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Orcish Bloodpainter', 'Grizzly Bears'], []],
    scripts: createRegistry([ORCISH_BLOODPAINTER_SCRIPT]),
  });
  const painter = put(g, 'p1', 'Orcish Bloodpainter');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, painter, bears };
}

describe('Orcish Bloodpainter', () => {
  test('the Bears pays and the ping hits the player', () => {
    const { g, painter, bears } = painted();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: painter,
        abilityIndex: 0,
        sacrifice: bears,
      }),
    );
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const { g, painter, bears } = painted();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: painter,
        abilityIndex: 0,
        sacrifice: bears,
      }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
