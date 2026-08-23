// `Thrashing Brontodon` — the self-sac destroy on both arms of the compound,
// and the indestructible refusal where it STAYS spent.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THRASHING_BRONTODON_SCRIPT } from './thrashingBrontodon';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BRONTO = 'Thrashing Brontodon';
const RING = 'Sol Ring';
const MANTRA = "Ajani's Mantra";
const MYR = 'Darksteel Myr';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function chomped(name: string): { g: Game; bronto: InstanceId; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BRONTO, RING, MANTRA, MYR], []],
    scripts: createRegistry([THRASHING_BRONTODON_SCRIPT]),
  });
  const bronto = put(g, 'p1', BRONTO);
  const victim = put(g, 'p1', name);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bronto, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, bronto, victim };
}

describe('Thrashing Brontodon', () => {
  test('it eats ITSELF and destroys the artifact', () => {
    const { g, bronto, victim } = chomped(RING);
    expect(g.state.cards[bronto]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('an ENCHANTMENT is the other arm', () => {
    const { g, victim } = chomped(MANTRA);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('an indestructible artifact survives — and the Brontodon STAYS spent', () => {
    const { g, bronto, victim } = chomped(MYR);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bronto]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = chomped(RING);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
