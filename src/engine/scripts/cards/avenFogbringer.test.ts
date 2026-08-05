// `Aven Fogbringer` — the ETB bounce, aimed at a land, homing to its OWNER.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AVEN_FOGBRINGER_SCRIPT } from './avenFogbringer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FOGBRINGER = 'Aven Fogbringer';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FOGBRINGER], ['Mountain']],
    scripts: createRegistry([AVEN_FOGBRINGER_SCRIPT]),
  });
  const mountain = put(g, 'p2', 'Mountain');
  settle(g);
  const bird = put(g, 'p1', FOGBRINGER, 'graveyard');
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: bird,
      to: { kind: 'battlefield', player: 'p1' },
    }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mountain }] }));
  settle(g);
  return { g, mountain };
}

describe('Aven Fogbringer', () => {
  test("entering returns the targeted land to its OWNER's hand", () => {
    const { g, mountain } = board();
    const zone = g.state.cards[mountain]?.zone;
    expect(zone?.kind).toBe('hand');
    expect(zone?.kind === 'hand' && zone.player).toBe('p2');
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
