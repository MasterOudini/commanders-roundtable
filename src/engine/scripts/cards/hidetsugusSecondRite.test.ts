// `Hidetsugu's Second Rite` — exactly 10 or nothing, both branches from
// real casts.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HIDETSUGUS_SECOND_RITE_SCRIPT } from './hidetsugusSecondRite';
import { HIDETSUGU_S_SECOND_RITE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rited(lifeFirst: number | null): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [["Hidetsugu's Second Rite"], ['Grizzly Bears']],
    scripts: createRegistry([HIDETSUGUS_SECOND_RITE_SCRIPT]),
  });
  settle(g);
  if (lifeFirst !== null) {
    must(g.submit({ t: 'ManualSetLife', player: 'p2', target: 'p2', delta: lifeFirst - 40 }));
  }
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Hidetsugu's Second Rite", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g };
}

describe("Hidetsugu's Second Rite", () => {
  test('at exactly 10 the target takes 10 and dies of it', () => {
    const { g } = rited(10);
    expect(g.state.players['p2']?.life).toBe(0);
  });

  test('at 40 nothing at all happens', () => {
    const { g } = rited(null);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HIDETSUGU_S_SECOND_RITE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HIDETSUGU_S_SECOND_RITE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HIDETSUGU_S_SECOND_RITE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    // The 40-life branch: the exactly-10 cast ends a two-player game on the
    // spot, and a finished game has no turn 2 to advance to.
    const { g } = rited(null);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
