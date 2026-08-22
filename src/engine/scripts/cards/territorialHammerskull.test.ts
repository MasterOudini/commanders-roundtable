// `Territorial Hammerskull` — attacking taps one of theirs. A batch-mate
// attacking instead pays nothing: the filter is SELF.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TERRITORIAL_HAMMERSKULL_SCRIPT } from './territorialHammerskull';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SKULL = 'Territorial Hammerskull';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** `self` attacks with the Hammerskull; otherwise a plain bear attacks alone. */
function attacked(self: boolean): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SKULL, BEARS], [BEARS]],
    scripts: createRegistry([TERRITORIAL_HAMMERSKULL_SCRIPT]),
  });
  const skull = put(g, 'p1', SKULL);
  const mine = put(g, 'p1', BEARS);
  const victim = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: self ? skull : mine, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  if (self) {
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  }
  settle(g);
  return { g, victim };
}

describe('Territorial Hammerskull', () => {
  test('its own attack taps a creature an opponent controls', () => {
    const { g, victim } = attacked(true);
    expect(g.state.cards[victim]?.tapped).toBe(true);
  });

  test("a batch-mate's attack asks nothing — the filter is SELF", () => {
    const { g, victim } = attacked(false);
    expect(g.state.cards[victim]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = attacked(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
