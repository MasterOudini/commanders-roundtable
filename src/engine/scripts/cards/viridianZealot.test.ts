// `Viridian Zealot` — it spends itself to break an artifact OR an
// enchantment, the compound noun proven on both halves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VIRIDIAN_ZEALOT_SCRIPT } from './viridianZealot';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ZEALOT = 'Viridian Zealot';
const RING = 'Sol Ring';
const MANTRA = "Ajani's Mantra"; // a plain enchantment
const CITADEL = 'Darksteel Citadel';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function activated(victimName: string): { g: Game; victim: InstanceId; zealot: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ZEALOT], [victimName]],
    scripts: createRegistry([VIRIDIAN_ZEALOT_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  const zealot = put(g, 'p1', ZEALOT);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: zealot, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim, zealot };
}

describe('Viridian Zealot', () => {
  test('it sacrifices itself and the ARTIFACT dies', () => {
    const { g, victim, zealot } = activated(RING);
    expect(g.state.cards[zealot]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('the ENCHANTMENT half of the compound works too', () => {
    const { g, victim } = activated(MANTRA);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('an INDESTRUCTIBLE artifact survives it', () => {
    const { g, victim } = activated(CITADEL);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = activated(RING);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
