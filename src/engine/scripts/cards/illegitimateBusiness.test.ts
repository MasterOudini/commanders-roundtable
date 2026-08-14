// `Illegitimate Business` — both printed rules on entry: tapped and the
// life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ILLEGITIMATE_BUSINESS_SCRIPT } from './illegitimateBusiness';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BUSINESS = 'Illegitimate Business';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; business: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BUSINESS], []],
    scripts: createRegistry([ILLEGITIMATE_BUSINESS_SCRIPT]),
  });
  const business = put(g, 'p1', BUSINESS, 'hand');
  must(g.submit({ t: 'PlayLand', player: 'p1', card: business }));
  settle(g);
  return { g, business };
}

describe('Illegitimate Business', () => {
  test('enters tapped AND pays 1 life — both printed rules', () => {
    const { g, business } = entered();
    expect(g.state.cards[business]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[business]?.tapped).toBe(true);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
