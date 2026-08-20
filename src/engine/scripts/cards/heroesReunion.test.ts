// `Heroes' Reunion` — target player gains 7.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HEROES_REUNION_SCRIPT } from './heroesReunion';
import { HEROES_REUNION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function reunited(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [["Heroes' Reunion"], ['Grizzly Bears']],
    scripts: createRegistry([HEROES_REUNION_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Heroes' Reunion", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p1' }] }));
  settle(g);
  return { g };
}

describe("Heroes' Reunion", () => {
  test('the target gains 7', () => {
    const { g } = reunited();
    expect(g.state.players['p1']?.life).toBe(47);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HEROES_REUNION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HEROES_REUNION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HEROES_REUNION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = reunited();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
