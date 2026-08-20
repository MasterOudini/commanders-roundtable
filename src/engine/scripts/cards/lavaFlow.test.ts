// `Lava Flow` — the compound's two arms: a creature dies, and a LAND
// dies to the same spell.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LAVA_FLOW_SCRIPT } from './lavaFlow';
import { LAVA_FLOW } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function flowed(name: string): { g: Game; target: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Lava Flow', 'Lava Flow'], ['Grizzly Bears', 'Swamp']],
    scripts: createRegistry([LAVA_FLOW_SCRIPT]),
  });
  const target = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Lava Flow', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return { g, target };
}

describe('Lava Flow', () => {
  test('a creature dies to it', () => {
    const { g, target } = flowed('Grizzly Bears');
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
  });

  test('a LAND dies to it — the compound holds both arms', () => {
    const { g, target } = flowed('Swamp');
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LAVA_FLOW.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LAVA_FLOW.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LAVA_FLOW.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = flowed('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
