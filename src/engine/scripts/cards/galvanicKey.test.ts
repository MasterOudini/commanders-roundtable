// `Galvanic Key` — the artifact untap behind {3},{T}; an upright target gets
// no event.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GALVANIC_KEY_SCRIPT } from './galvanicKey';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const KEY = 'Galvanic Key';
const ARCHIVE = 'Hedron Archive';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function untaps(g: Game, card: InstanceId): number {
  return g.log.filter((e) => e.body.t === 'PermanentsUntapped' && e.body.cards.includes(card))
    .length;
}

function board(): { g: Game; key: InstanceId; archive: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[KEY, ARCHIVE], []],
    scripts: createRegistry([GALVANIC_KEY_SCRIPT]),
  });
  const key = put(g, 'p1', KEY);
  const archive = put(g, 'p1', ARCHIVE);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  return { g, key, archive };
}

describe('Galvanic Key', () => {
  test('untaps the tapped artifact', () => {
    const { g, key, archive } = board();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [archive], tapped: true }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: key,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: archive }],
      }),
    );
    settle(g);
    expect(g.state.cards[archive]?.tapped).toBe(false);
    expect(untaps(g, archive)).toBe(1);
  });

  test('an UPRIGHT target gets no event', () => {
    const { g, key, archive } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: key,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: archive }],
      }),
    );
    settle(g);
    expect(untaps(g, archive)).toBe(0);
  });

  test('replays to the same hash', () => {
    const { g, key, archive } = board();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [archive], tapped: true }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: key,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: archive }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
