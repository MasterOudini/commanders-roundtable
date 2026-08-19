// `Fumigate` — the gain counts creatures DESTROYED THIS WAY: the
// indestructible survivor pays nothing, which is the whole difference
// from "for each creature".

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FUMIGATE_SCRIPT } from './fumigate';
import { FUMIGATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(withMyr: boolean): Game {
  const g = startedGame({
    players: 2,
    decks: [['Fumigate', 'Grizzly Bears'], ['Grizzly Bears', 'Darksteel Myr']],
    scripts: createRegistry([FUMIGATE_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p2', 'Grizzly Bears');
  if (withMyr) put(g, 'p2', 'Darksteel Myr');
  settle(g);
  const wrath = put(g, 'p1', 'Fumigate', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: wrath }));
  settle(g);
  return g;
}

describe('Fumigate', () => {
  test('two die, two life gained', () => {
    const g = board(false);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the indestructible survivor is NOT counted — still two, not three', () => {
    const g = board(true);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FUMIGATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FUMIGATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FUMIGATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = board(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
