// `Essence Drain` — 3 at the face, 3 back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ESSENCE_DRAIN_SCRIPT } from './essenceDrain';
import { ESSENCE_DRAIN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drained(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Essence Drain'], ['Grizzly Bears']],
    scripts: createRegistry([ESSENCE_DRAIN_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Essence Drain', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g };
}

describe('Essence Drain', () => {
  test('3 at the face and 3 back', () => {
    const { g } = drained();
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ESSENCE_DRAIN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ESSENCE_DRAIN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ESSENCE_DRAIN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = drained();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
