// `Landroval, Horizon Witness` — two of mine attacking a player fire the
// trigger and the attacking Bears is lifted; Landroval attacking alone does
// not fire it; the Bears at home is refused (D291).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LANDROVAL_HORIZON_WITNESS_SCRIPT } from './landrovalHorizonWitness';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Landroval, Horizon Witness';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; bird: InstanceId; bears: InstanceId; home: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARS, BEARS], []], scripts: createRegistry([LANDROVAL_HORIZON_WITNESS_SCRIPT]) });
  const bird = put(g, 'p1', CARD);
  const bears = put(g, 'p1', BEARS);
  const home = put(g, 'p1', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  return { g, bird, bears, home };
}

describe('Landroval, Horizon Witness', () => {
  test('two attackers fire it: the attacking Bears gains flying; the one at home is refused', () => {
    const { g, bird, bears, home } = ready();
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [
          { card: bird, defender: { kind: 'player', id: 'p2' } },
          { card: bears, defender: { kind: 'player', id: 'p2' } },
        ],
      }),
    );
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: home }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const d = deps(createRegistry([LANDROVAL_HORIZON_WITNESS_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, bears).keywords.has('flying')).toBe(true);
  });

  test('attacking alone does not fire it', () => {
    const { g, bird } = ready();
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bird, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    expect(g.state.priority.awaiting?.kind).not.toBe('chooseTargets');
    expect(g.log.some((e) => e.body.t === 'PtModifiedUntilEndOfTurn')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, bird, bears } = ready();
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [
          { card: bird, defender: { kind: 'player', id: 'p2' } },
          { card: bears, defender: { kind: 'player', id: 'p2' } },
        ],
      }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
