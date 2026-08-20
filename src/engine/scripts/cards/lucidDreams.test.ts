// `Lucid Dreams` — creature + artifact + instant in the graveyard make
// three types: three cards.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LUCID_DREAMS_SCRIPT } from './lucidDreams';
import { LUCID_DREAMS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dreamt(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Lucid Dreams', 'Grizzly Bears', 'Sol Ring', 'Heat Ray'], []],
    scripts: createRegistry([LUCID_DREAMS_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears', 'graveyard');
  put(g, 'p1', 'Sol Ring', 'graveyard');
  put(g, 'p1', 'Heat Ray', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Lucid Dreams', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, mid };
}

describe('Lucid Dreams', () => {
  test('creature, artifact, and instant: three types, three cards', () => {
    const { g, mid } = dreamt();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LUCID_DREAMS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LUCID_DREAMS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LUCID_DREAMS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = dreamt();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
