// `Early Harvest` — the target's tapped basics straighten; their tapped
// nonbasic land and creature stay turned.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { EARLY_HARVEST_SCRIPT } from './earlyHarvest';
import { EARLY_HARVEST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function harvested(): { g: Game; swamp: InstanceId; citadel: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Early Harvest'], ['Swamp', 'Darksteel Citadel', 'Grizzly Bears']],
    scripts: createRegistry([EARLY_HARVEST_SCRIPT]),
  });
  const swamp = put(g, 'p2', 'Swamp');
  const citadel = put(g, 'p2', 'Darksteel Citadel');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [swamp, citadel, bears], tapped: true }));
  const spell = put(g, 'p1', 'Early Harvest', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, swamp, citadel, bears };
}

describe('Early Harvest', () => {
  test('the basic straightens; the nonbasic land and the creature stay tapped', () => {
    const { g, swamp, citadel, bears } = harvested();
    expect(g.state.cards[swamp]?.tapped).toBe(false);
    expect(g.state.cards[citadel]?.tapped).toBe(true);
    expect(g.state.cards[bears]?.tapped).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = EARLY_HARVEST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, EARLY_HARVEST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(EARLY_HARVEST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = harvested();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
