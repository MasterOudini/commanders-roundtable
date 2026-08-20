// `Fissure` — a creature target and a land target both die; Darksteel
// Citadel survives from either noun.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FISSURE_SCRIPT } from './fissure';
import { FISSURE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fissured(name: 'Grizzly Bears' | 'Mountain' | 'Darksteel Citadel'): {
  g: Game;
  victim: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [['Fissure'], ['Grizzly Bears', 'Mountain', 'Darksteel Citadel']],
    scripts: createRegistry([FISSURE_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Fissure', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Fissure', () => {
  test('a creature dies to it', () => {
    const { g, victim } = fissured('Grizzly Bears');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('a land dies to it; Darksteel Citadel survives', () => {
    const a = fissured('Mountain');
    expect(a.g.state.cards[a.victim]?.zone.kind).toBe('graveyard');
    const b = fissured('Darksteel Citadel');
    expect(b.g.state.cards[b.victim]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FISSURE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FISSURE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FISSURE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fissured('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
