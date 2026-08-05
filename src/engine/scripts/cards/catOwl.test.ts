// `Cat-Owl` — attacking untaps the chosen permanent, proven on ITSELF: the
// attack taps it, the trigger straightens it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CAT_OWL_SCRIPT } from './catOwl';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const OWL = 'Cat-Owl';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fought(): { g: Game; owl: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[OWL], []],
    scripts: createRegistry([CAT_OWL_SCRIPT]),
  });
  const owl = put(g, 'p1', OWL);
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    20_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: owl, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: owl }] }));
  settle(g);
  return { g, owl };
}

describe('Cat-Owl', () => {
  test('attacking untaps the chosen permanent — itself, straightened mid-combat', () => {
    const { g, owl } = fought();
    expect(
      g.log.some((e) => e.body.t === 'PermanentsUntapped' && e.body.cards.includes(owl)),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = fought();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
