// `Creeping Mold` — any of the three kinds; a CREATURE is refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CREEPING_MOLD_SCRIPT } from './creepingMold';
import { CREEPING_MOLD } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; land: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Creeping Mold'], ['Mountain', 'Grizzly Bears']],
    scripts: createRegistry([CREEPING_MOLD_SCRIPT]),
  });
  const land = put(g, 'p2', 'Mountain');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Creeping Mold', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, land, bears };
}

describe('Creeping Mold', () => {
  test('a LAND dies to it', () => {
    const { g, land } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
  });

  test('a CREATURE is refused — the compound has three kinds and creature is not one', () => {
    const { g, bears } = armed();
    const verdict = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] });
    expect(verdict.ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CREEPING_MOLD.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CREEPING_MOLD.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CREEPING_MOLD.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, land } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
