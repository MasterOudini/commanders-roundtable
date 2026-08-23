// `Voracious Varmint` — it spends itself to break an artifact OR an
// enchantment; vigilance is the line above and never an ability.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VORACIOUS_VARMINT_SCRIPT } from './voraciousVarmint';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const VARMINT = 'Voracious Varmint';
const RING = 'Sol Ring';
const MANTRA = "Ajani's Mantra";
const CITADEL = 'Darksteel Citadel';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function activated(victimName: string): { g: Game; victim: InstanceId; varmint: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[VARMINT], [victimName]],
    scripts: createRegistry([VORACIOUS_VARMINT_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  const varmint = put(g, 'p1', VARMINT);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: varmint, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim, varmint };
}

describe('Voracious Varmint', () => {
  test('it sacrifices itself and the ARTIFACT dies', () => {
    const { g, victim, varmint } = activated(RING);
    expect(g.state.cards[varmint]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('the ENCHANTMENT half works too', () => {
    const { g, victim } = activated(MANTRA);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('an INDESTRUCTIBLE artifact survives it', () => {
    const { g, victim } = activated(CITADEL);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
  });

  test('vigilance is still granted by the line the def does not claim', () => {
    const g = startedGame({
      players: 2,
      decks: [[VARMINT], []],
      scripts: createRegistry([VORACIOUS_VARMINT_SCRIPT]),
    });
    const varmint = put(g, 'p1', VARMINT);
    settle(g);
    const d = deps(createRegistry([VORACIOUS_VARMINT_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, varmint).keywords.has('vigilance')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = activated(RING);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
