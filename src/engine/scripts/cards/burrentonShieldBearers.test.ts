// `Burrenton Shield-Bearers` — attacking asks for a +0/+3 target, through a
// real declared attack.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BURRENTON_SHIELD_BEARERS_SCRIPT } from './burrentonShieldBearers';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BEARERS = 'Burrenton Shield-Bearers';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fought(): { g: Game; bearers: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BEARERS], []],
    scripts: createRegistry([BURRENTON_SHIELD_BEARERS_SCRIPT]),
  });
  const bearers = put(g, 'p1', BEARERS);
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
      attackers: [{ card: bearers, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bearers }] }));
  settle(g);
  return { g, bearers };
}

describe('Burrenton Shield-Bearers', () => {
  test('attacking gives the chosen creature +0/+3 until end of turn', () => {
    const { g, bearers } = fought();
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' &&
          e.body.card === bearers &&
          e.body.power === 0 &&
          e.body.toughness === 3,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = fought();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
