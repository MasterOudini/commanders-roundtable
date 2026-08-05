// `Bigfin Bouncer` — bounces an OPPONENT's creature; your own is refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BIGFIN_BOUNCER_SCRIPT } from './bigfinBouncer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BOUNCER = 'Bigfin Bouncer';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [BOUNCER, 'Grizzly Bears'],
      ['Silvercoat Lion'],
    ],
    scripts: createRegistry([BIGFIN_BOUNCER_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Silvercoat Lion');
  settle(g);
  const shark = put(g, 'p1', BOUNCER, 'graveyard');
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: shark,
      to: { kind: 'battlefield', player: 'p1' },
    }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  return { g, mine, theirs };
}

describe('Bigfin Bouncer', () => {
  test("your OWN creature is refused; the opponent's goes to their hand", () => {
    const { g, mine, theirs } = board();
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] });
    expect(res.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    const zone = g.state.cards[theirs]?.zone;
    expect(zone?.kind).toBe('hand');
    expect(zone?.kind === 'hand' && zone.player).toBe('p2');
  });

  test('replays to the same hash', () => {
    const { g, theirs } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
