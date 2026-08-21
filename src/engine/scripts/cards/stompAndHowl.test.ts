// `Stomp and Howl` — the probed two-spec destroy: an artifact AND an
// enchantment die in one cast.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STOMP_AND_HOWL_SCRIPT } from './stompAndHowl';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stomped(): { g: Game; ring: InstanceId; dog: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Stomp and Howl'], ['Sol Ring', 'Spirited Companion']],
    scripts: createRegistry([STOMP_AND_HOWL_SCRIPT]),
  });
  const ring = put(g, 'p2', 'Sol Ring');
  const dog = put(g, 'p2', 'Spirited Companion');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Stomp and Howl', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: ring },
        { kind: 'card', id: dog },
      ],
    }),
  );
  settle(g);
  return { g, ring, dog };
}

describe('Stomp and Howl', () => {
  test('both targets die in one resolve', () => {
    const { g, ring, dog } = stomped();
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[dog]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = stomped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
