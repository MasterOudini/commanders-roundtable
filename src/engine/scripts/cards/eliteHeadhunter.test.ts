// `Elite Headhunter` — ANOTHER creature pays (never itself), and the 2
// damage kills a 2/2 through the SBA.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ELITE_HEADHUNTER_SCRIPT } from './eliteHeadhunter';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HEADHUNTER = 'Elite Headhunter';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; headhunter: InstanceId; myBears: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[HEADHUNTER, BEARS], [BEARS]],
    scripts: createRegistry([ELITE_HEADHUNTER_SCRIPT]),
  });
  const headhunter = put(g, 'p1', HEADHUNTER);
  const myBears = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  // {B/R}×3 paid all-black.
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  return { g, headhunter, myBears, theirs };
}

describe('Elite Headhunter', () => {
  test('another creature pays, and the 2 damage kills the target', () => {
    const { g, headhunter, myBears, theirs } = board();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: headhunter, abilityIndex: 0, sacrifice: myBears }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    expect(g.state.cards[myBears]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[headhunter]?.zone.kind).toBe('battlefield');
  });

  test('the Headhunter cannot pay with ITSELF — the predicate says another', () => {
    const { g, headhunter } = board();
    const r = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: headhunter,
      abilityIndex: 0,
      sacrifice: headhunter,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, headhunter, myBears, theirs } = board();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: headhunter, abilityIndex: 0, sacrifice: myBears }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
