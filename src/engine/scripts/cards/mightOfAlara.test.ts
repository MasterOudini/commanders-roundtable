// `Might of Alara` — Gaea's Might's text on its own id: two basic types,
// +2/+2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MIGHT_OF_ALARA_SCRIPT } from './mightOfAlara';
import { MIGHT_OF_ALARA, GAEA_S_MIGHT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mighted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Might of Alara', 'Grizzly Bears', 'Forest', 'Mountain'], []],
    scripts: createRegistry([MIGHT_OF_ALARA_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Forest');
  put(g, 'p1', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Might of Alara', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }),
  );
  settle(g);
  return { g, bears };
}

describe('Might of Alara', () => {
  test('carries the family text verbatim', () => {
    expect(MIGHT_OF_ALARA.faces[0]?.oracleText).toBe(GAEA_S_MIGHT.faces[0]?.oracleText);
  });

  test('two basic types make the Bears 4/4', () => {
    const { g, bears } = mighted();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(4);
    expect(d.toughness).toBe(4);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MIGHT_OF_ALARA.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MIGHT_OF_ALARA.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MIGHT_OF_ALARA.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = mighted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
