// `Kiss of Death` — 4 across the table and 4 back to me.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { KISS_OF_DEATH_SCRIPT } from './kissOfDeath';
import { KISS_OF_DEATH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kissed(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Kiss of Death'], ['Grizzly Bears']],
    scripts: createRegistry([KISS_OF_DEATH_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Kiss of Death', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g };
}

describe('Kiss of Death', () => {
  test('the opponent takes 4 and I gain 4', () => {
    const { g } = kissed();
    expect(g.state.players['p2']?.life).toBe(36);
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = KISS_OF_DEATH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, KISS_OF_DEATH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(KISS_OF_DEATH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = kissed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
