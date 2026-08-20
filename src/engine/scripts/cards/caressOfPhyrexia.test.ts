// `Caress of Phyrexia` — the target draws 3, pays 3, and takes THREE
// poison counters — the first script writing poison directly.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CARESS_OF_PHYREXIA_SCRIPT } from './caressOfPhyrexia';
import { CARESS_OF_PHYREXIA } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function caressed(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Caress of Phyrexia'], ['Grizzly Bears']],
    scripts: createRegistry([CARESS_OF_PHYREXIA_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const before = (g.state.zones.hand['p2'] ?? []).length;
  const spell = put(g, 'p1', 'Caress of Phyrexia', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, before };
}

describe('Caress of Phyrexia', () => {
  test('draws 3, loses 3, THREE poison', () => {
    const { g, before } = caressed();
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(before + 3);
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.players['p2']?.poison).toBe(3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CARESS_OF_PHYREXIA.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CARESS_OF_PHYREXIA.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CARESS_OF_PHYREXIA.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = caressed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
