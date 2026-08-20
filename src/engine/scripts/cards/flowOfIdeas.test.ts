// `Flow of Ideas` — three Islands draw three.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FLOW_OF_IDEAS_SCRIPT } from './flowOfIdeas';
import { FLOW_OF_IDEAS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function flowed(): { g: Game; mine: number } {
  const g = startedGame({
    players: 2,
    decks: [['Flow of Ideas', 'Island', 'Island', 'Island'], ['Grizzly Bears']],
    scripts: createRegistry([FLOW_OF_IDEAS_SCRIPT]),
  });
  put(g, 'p1', 'Island');
  put(g, 'p1', 'Island');
  put(g, 'p1', 'Island');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Flow of Ideas', 'hand');
  const mine = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine };
}

describe('Flow of Ideas', () => {
  test('three Islands draw three', () => {
    const { g, mine } = flowed();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mine + 3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FLOW_OF_IDEAS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FLOW_OF_IDEAS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FLOW_OF_IDEAS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = flowed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
