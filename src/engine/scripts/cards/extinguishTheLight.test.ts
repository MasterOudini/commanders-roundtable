// `Extinguish the Light` — the MV-2 victim pays 3 life back; the MV-6 one
// pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { EXTINGUISH_THE_LIGHT_SCRIPT } from './extinguishTheLight';
import { EXTINGUISH_THE_LIGHT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function extinguished(name: 'Grizzly Bears' | 'Colossal Dreadmaw'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Extinguish the Light'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([EXTINGUISH_THE_LIGHT_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Extinguish the Light', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Extinguish the Light', () => {
  test('the MV-2 victim dies and pays 3 life', () => {
    const { g, victim } = extinguished('Grizzly Bears');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('the MV-6 victim dies for nothing', () => {
    const { g, victim } = extinguished('Colossal Dreadmaw');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = EXTINGUISH_THE_LIGHT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, EXTINGUISH_THE_LIGHT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(EXTINGUISH_THE_LIGHT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = extinguished('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
