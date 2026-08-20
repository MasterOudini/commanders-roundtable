// `Compleat Devotion` — the pump always; the draw only on a DERIVED toxic
// creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { COMPLEAT_DEVOTION_SCRIPT } from './compleatDevotion';
import { COMPLEAT_DEVOTION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function devoted(name: 'Bloated Contaminator' | 'Grizzly Bears'): { g: Game; target: InstanceId; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Compleat Devotion', 'Bloated Contaminator', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([COMPLEAT_DEVOTION_SCRIPT]),
  });
  const target = put(g, 'p1', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Compleat Devotion', 'hand');
  const before = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return { g, target, before };
}

describe('Compleat Devotion', () => {
  test('a TOXIC target pays the pump AND the draw', () => {
    const { g, target, before } = devoted('Bloated Contaminator');
    expect(derive(g.state, ORACLE, g.deps.scripts, target).power).toBe(6);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
  });

  test('a toxic-less target pays the pump alone', () => {
    const { g, before } = devoted('Grizzly Bears');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = COMPLEAT_DEVOTION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, COMPLEAT_DEVOTION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(COMPLEAT_DEVOTION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = devoted('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
