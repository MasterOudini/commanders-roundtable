// `Flamekin Spitfire` — the repeatable ping reaches a creature and a
// player.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FLAMEKIN_SPITFIRE_SCRIPT } from './flamekinSpitfire';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPITFIRE = 'Flamekin Spitfire';
const SMALL = 'Devout Monk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; spitfire: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPITFIRE], [SMALL]],
    scripts: createRegistry([FLAMEKIN_SPITFIRE_SCRIPT]),
  });
  const spitfire = put(g, 'p1', SPITFIRE);
  const theirs = put(g, 'p2', SMALL);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  return { g, spitfire, theirs };
}

describe('Flamekin Spitfire', () => {
  test('the 1 damage kills a 1/1 through the SBA', () => {
    const { g, spitfire, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: spitfire, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('pinging a PLAYER moves their life', () => {
    const { g, spitfire } = armed();
    const lifeBefore = g.state.players['p2']?.life ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: spitfire, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(lifeBefore - 1);
  });

  test('replays to the same hash', () => {
    const { g, spitfire, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: spitfire, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
