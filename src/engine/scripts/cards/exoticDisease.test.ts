// `Exotic Disease` — a Swamp and a Mountain make X = 2: the target loses
// 2 and I gain 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { EXOTIC_DISEASE_SCRIPT } from './exoticDisease';
import { EXOTIC_DISEASE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function diseased(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Exotic Disease', 'Swamp', 'Mountain'], ['Grizzly Bears']],
    scripts: createRegistry([EXOTIC_DISEASE_SCRIPT]),
  });
  put(g, 'p1', 'Swamp');
  put(g, 'p1', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Exotic Disease', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g };
}

describe('Exotic Disease', () => {
  test('Domain 2: the target loses 2, I gain 2', () => {
    const { g } = diseased();
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = EXOTIC_DISEASE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, EXOTIC_DISEASE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(EXOTIC_DISEASE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = diseased();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
