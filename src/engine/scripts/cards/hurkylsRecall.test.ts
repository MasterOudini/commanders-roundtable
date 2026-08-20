// `Hurkyl's Recall` — everything the target OWNS comes home, including
// the artifact creature; my own artifact stays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HURKYLS_RECALL_SCRIPT } from './hurkylsRecall';
import { HURKYL_S_RECALL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function recalled(): { g: Game; ring: InstanceId; strix: InstanceId; locket: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Hurkyl's Recall", 'Azorius Locket'], ['Sol Ring', 'Baleful Strix']],
    scripts: createRegistry([HURKYLS_RECALL_SCRIPT]),
  });
  const locket = put(g, 'p1', 'Azorius Locket');
  const ring = put(g, 'p2', 'Sol Ring');
  const strix = put(g, 'p2', 'Baleful Strix');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Hurkyl's Recall", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, ring, strix, locket };
}

describe("Hurkyl's Recall", () => {
  test("the target's Ring and artifact creature go to their hand; MY Locket stays", () => {
    const { g, ring, strix, locket } = recalled();
    expect((g.state.zones.hand['p2'] ?? []).includes(ring)).toBe(true);
    expect((g.state.zones.hand['p2'] ?? []).includes(strix)).toBe(true);
    expect(g.state.cards[locket]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HURKYL_S_RECALL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HURKYL_S_RECALL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HURKYL_S_RECALL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = recalled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
