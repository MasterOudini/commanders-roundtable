// `Gruesome Fate` — each opponent loses my creature count.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GRUESOME_FATE_SCRIPT } from './gruesomeFate';
import { GRUESOME_FATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fated(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Gruesome Fate', 'Grizzly Bears', 'Grizzly Bears', 'Elvish Herder'], []],
    scripts: createRegistry([GRUESOME_FATE_SCRIPT]),
  });
  const a = put(g, 'p1', 'Grizzly Bears');
  const b = put(g, 'p1', 'Grizzly Bears');
  expect(b).not.toBe(a);
  put(g, 'p1', 'Elvish Herder');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Gruesome Fate', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g };
}

describe('Gruesome Fate', () => {
  test('three creatures cost the opponent 3 life — and me nothing', () => {
    const { g } = fated();
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GRUESOME_FATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GRUESOME_FATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GRUESOME_FATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
