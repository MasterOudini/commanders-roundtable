// `Zuran Spellcaster` — the {T} ping at a player and at a creature, past
// summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ZURAN_SPELLCASTER_SCRIPT } from './zuranSpellcaster';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CASTER = 'Zuran Spellcaster';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; caster: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CASTER], [BEARS]],
    scripts: createRegistry([ZURAN_SPELLCASTER_SCRIPT]),
  });
  const bears = put(g, 'p2', BEARS);
  const caster = put(g, 'p1', CASTER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, caster, bears };
}

describe('Zuran Spellcaster', () => {
  test('taps and deals 1 to a player', () => {
    const { g, caster } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: caster, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[caster]?.tapped).toBe(true);
  });

  test('the same 1 marks a creature', () => {
    const { g, caster, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: caster, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.damage).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, caster } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: caster, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
