// `Nightscape Master` — two blue and the tap bounce a creature to its
// owner's hand; two red and the tap deal it 2 (a 2/2 dies).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NIGHTSCAPE_MASTER_SCRIPT } from './nightscapeMaster';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MASTER = 'Nightscape Master';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; master: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MASTER], [BEARS]],
    scripts: createRegistry([NIGHTSCAPE_MASTER_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const master = put(g, 'p1', MASTER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, master, theirs };
}

describe('Nightscape Master', () => {
  test('{U}{U}, {T}: the creature goes to its owner hand', () => {
    const { g, master, theirs } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: master, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone).toEqual({ kind: 'hand', player: 'p2' });
    expect(g.state.cards[master]?.tapped).toBe(true);
  });

  test('{R}{R}, {T}: 2 damage kills the 2/2', () => {
    const { g, master, theirs } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: master, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, master, theirs } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: master, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
