// `Trusted Pegasus` — Roc Charger's twin: the attacking Bears is lifted; the
// one at home is refused (D291).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TRUSTED_PEGASUS_SCRIPT } from './trustedPegasus';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Trusted Pegasus';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacked(): { g: Game; bears: InstanceId; home: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARS, BEARS], []], scripts: createRegistry([TRUSTED_PEGASUS_SCRIPT]) });
  const pegasus = put(g, 'p1', CARD);
  const bears = put(g, 'p1', BEARS);
  const home = put(g, 'p1', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [
        { card: pegasus, defender: { kind: 'player', id: 'p2' } },
        { card: bears, defender: { kind: 'player', id: 'p2' } },
      ],
    }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  return { g, bears, home };
}

describe('Trusted Pegasus', () => {
  test('the attacking Bears gains flying until end of turn', () => {
    const { g, bears } = attacked();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const d = deps(createRegistry([TRUSTED_PEGASUS_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, bears).keywords.has('flying')).toBe(true);
  });

  test('a creature that stayed home is refused (D291)', () => {
    const { g, home } = attacked();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: home }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, bears } = attacked();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
