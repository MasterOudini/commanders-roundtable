// `Cloudchaser Eagle` — the ETB enchantment destroy.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CLOUDCHASER_EAGLE_SCRIPT } from './cloudchaserEagle';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const EAGLE = 'Cloudchaser Eagle';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mantra: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[EAGLE], ["Ajani's Mantra"]],
    scripts: createRegistry([CLOUDCHASER_EAGLE_SCRIPT]),
  });
  const mantra = put(g, 'p2', "Ajani's Mantra");
  settle(g);
  const eagle = put(g, 'p1', EAGLE, 'graveyard');
  settle(g);
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: eagle, to: { kind: 'battlefield', player: 'p1' } }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mantra }] }));
  settle(g);
  return { g, mantra };
}

describe('Cloudchaser Eagle', () => {
  test('entering destroys the targeted enchantment', () => {
    const { g, mantra } = board();
    expect(g.state.cards[mantra]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
