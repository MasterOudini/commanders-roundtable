// `Spire Mangler` — entering gives my flyer +2/+0 until end of turn; my
// ground creature is refused (D289).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPIRE_MANGLER_SCRIPT } from './spireMangler';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Spire Mangler';
const HAWK = 'Vampire Nighthawk';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; hawk: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, HAWK, BEARS], []], scripts: createRegistry([SPIRE_MANGLER_SCRIPT]) });
  const hawk = put(g, 'p1', HAWK);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  const mangler = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mangler, to: { kind: 'battlefield', player: 'p1' } }));
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  return { g, hawk, bears };
}

describe('Spire Mangler', () => {
  test('my flyer gets +2/+0 until end of turn', () => {
    const { g, hawk } = entered();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    const d = deps(createRegistry([SPIRE_MANGLER_SCRIPT]));
    const got = derive(g.state, d.oracle, d.scripts, hawk);
    expect([got.power, got.toughness]).toEqual([4, 3]);
  });

  test('my ground creature is refused (D289)', () => {
    const { g, bears } = entered();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, hawk } = entered();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
