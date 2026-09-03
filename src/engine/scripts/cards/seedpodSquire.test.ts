// `Seedpod Squire` — attacking on turn 3 asks for a ground creature of mine,
// which gets +1/+1; my flyer is refused (D289).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEEDPOD_SQUIRE_SCRIPT } from './seedpodSquire';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Seedpod Squire';
const HAWK = 'Vampire Nighthawk';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacked(): { g: Game; bears: InstanceId; hawk: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARS, HAWK], []], scripts: createRegistry([SEEDPOD_SQUIRE_SCRIPT]) });
  const squire = put(g, 'p1', CARD);
  const bears = put(g, 'p1', BEARS);
  const hawk = put(g, 'p1', HAWK);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: squire, defender: { kind: 'player', id: 'p2' } }] }));
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  return { g, bears, hawk };
}

describe('Seedpod Squire', () => {
  test('the chosen ground creature gets +1/+1 until end of turn', () => {
    const { g, bears } = attacked();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(
      g.log.some((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === bears && e.body.power === 1 && e.body.toughness === 1),
    ).toBe(true);
  });

  test('my flyer is refused (D289)', () => {
    const { g, hawk } = attacked();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, bears } = attacked();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
