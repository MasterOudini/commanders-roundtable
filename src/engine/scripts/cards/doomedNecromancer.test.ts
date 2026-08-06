// `Doomed Necromancer` — the first script REANIMATION: the target is aimed
// into MY graveyard, the cost is charged on the answer (CR 601.2), and the
// returned card is a battlefield permanent again.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DOOMED_NECROMANCER_SCRIPT } from './doomedNecromancer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const NECRO = 'Doomed Necromancer';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; necro: InstanceId; bears: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[NECRO, BEARS], [BEARS]],
    scripts: createRegistry([DOOMED_NECROMANCER_SCRIPT]),
  });
  const necro = put(g, 'p1', NECRO);
  const bears = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
  must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'graveyard', player: 'p2' } }));
  settle(g);
  // {T} in the cost — the Necromancer must be past summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  return { g, necro, bears, theirs };
}

describe('Doomed Necromancer', () => {
  test('reanimates from MY graveyard, with the cost charged on the answer', () => {
    const { g, necro, bears, theirs } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: necro, abilityIndex: 0 }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    // CR 601.2c before 601.2g — nothing has been paid while the question is up.
    expect(g.state.cards[necro]?.zone.kind).toBe('battlefield');
    // An OPPONENT's graveyard is not "your graveyard".
    const wrong = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] });
    expect(wrong.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    // The answer charges the cost: the Necromancer is sacrificed.
    expect(g.state.cards[necro]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.controller).toBe('p1');
  });

  test('replays to the same hash', () => {
    const { g, necro, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: necro, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
