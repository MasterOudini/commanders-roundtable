// `Harsh Sustenance` — two creatures make X = 2: 2 at the opponent and
// 2 life to me, one census.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HARSH_SUSTENANCE_SCRIPT } from './harshSustenance';
import { HARSH_SUSTENANCE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sustained(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Harsh Sustenance', 'Grizzly Bears', 'Elvish Herder'], []],
    scripts: createRegistry([HARSH_SUSTENANCE_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Elvish Herder');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Harsh Sustenance', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g };
}

describe('Harsh Sustenance', () => {
  test('two creatures: 2 damage across, 2 life back', () => {
    const { g } = sustained();
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HARSH_SUSTENANCE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HARSH_SUSTENANCE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HARSH_SUSTENANCE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = sustained();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
