// `Infernal Grasp` — unconditional destroy, and the price is paid whether
// or not the destruction happens (indestructible stops the DESTROY, not
// the spell).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INFERNAL_GRASP_SCRIPT } from './infernalGrasp';
import { INFERNAL_GRASP } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(victim: string): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Infernal Grasp'], [victim]],
    scripts: createRegistry([INFERNAL_GRASP_SCRIPT]),
  });
  const theirs = put(g, 'p2', victim);
  settle(g);
  const grasp = put(g, 'p1', 'Infernal Grasp', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: grasp }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  settle(g);
  return { g, theirs };
}

describe('Infernal Grasp', () => {
  test('destroys the Bears and costs 2 life', () => {
    const { g, theirs } = board('Grizzly Bears');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('an indestructible target survives — and the 2 life is still lost', () => {
    const { g, theirs } = board('Darksteel Myr');
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INFERNAL_GRASP.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INFERNAL_GRASP.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INFERNAL_GRASP.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
