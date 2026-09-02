// `Zealous Lorecaster` — the entry returns an instant from MY graveyard to
// hand; a creature card there is not a legal target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ZEALOUS_LORECASTER_SCRIPT } from './zealousLorecaster';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LORECASTER = 'Zealous Lorecaster';
const INSTANT = 'Vitalize';
const CREATURE = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; instant: InstanceId; creature: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LORECASTER, INSTANT, CREATURE], []],
    scripts: createRegistry([ZEALOUS_LORECASTER_SCRIPT]),
  });
  const instant = put(g, 'p1', INSTANT, 'graveyard');
  const creature = put(g, 'p1', CREATURE, 'graveyard');
  settle(g);
  put(g, 'p1', LORECASTER);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, instant, creature };
}

describe('Zealous Lorecaster', () => {
  test('the instant comes back to hand', () => {
    const { g, instant } = entered();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: instant }] }));
    settle(g);
    expect(g.state.cards[instant]?.zone.kind).toBe('hand');
  });

  test('a CREATURE card in the graveyard is refused at the aim', () => {
    const { g, creature } = entered();
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: creature }] });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, instant } = entered();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: instant }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
