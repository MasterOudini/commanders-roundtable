// `Ancient Craving` — Ambition's Cost's text on its own oracle id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ANCIENT_CRAVING_SCRIPT } from './ancientCraving';
import { ANCIENT_CRAVING } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; libBefore: number } {
  const g = startedGame({
    players: 2,
    decks: [['Ancient Craving', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([ANCIENT_CRAVING_SCRIPT]),
  });
  const spell = put(g, 'p1', 'Ancient Craving', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  const libBefore = g.state.zones.library['p1']?.length ?? 0;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, libBefore };
}

describe('Ancient Craving', () => {
  test('three cards, three life — the twin proven on its own id', () => {
    const { g, libBefore } = cast();
    expect(g.state.zones.library['p1']?.length).toBe(libBefore - 3);
    expect(g.state.players['p1']?.life).toBe(37);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ANCIENT_CRAVING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ANCIENT_CRAVING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ANCIENT_CRAVING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
