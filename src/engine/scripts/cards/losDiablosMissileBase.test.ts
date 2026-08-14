// `Los Diablos Missile Base` — both printed rules on entry: tapped and the
// life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LOS_DIABLOS_MISSILE_BASE_SCRIPT } from './losDiablosMissileBase';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BASE = 'Los Diablos Missile Base';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; base: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BASE], []],
    scripts: createRegistry([LOS_DIABLOS_MISSILE_BASE_SCRIPT]),
  });
  const base = put(g, 'p1', BASE, 'hand');
  must(g.submit({ t: 'PlayLand', player: 'p1', card: base }));
  settle(g);
  return { g, base };
}

describe('Los Diablos Missile Base', () => {
  test('enters tapped AND pays 1 life — both printed rules', () => {
    const { g, base } = entered();
    expect(g.state.cards[base]?.tapped).toBe(true);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
