// `Feed the Swarm` — the opponent's enchantment dies and the caster pays
// its mana value.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FEED_THE_SWARM_SCRIPT } from './feedTheSwarm';
import { FEED_THE_SWARM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fed(): { g: Game; flame: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Feed the Swarm'], ['Captive Flame']],
    scripts: createRegistry([FEED_THE_SWARM_SCRIPT]),
  });
  const flame = put(g, 'p2', 'Captive Flame');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Feed the Swarm', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: flame }] }));
  settle(g);
  return { g, flame };
}

describe('Feed the Swarm', () => {
  test('the enchantment dies and the caster pays its MV', () => {
    const { g, flame } = fed();
    expect(g.state.cards[flame]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(37);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FEED_THE_SWARM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FEED_THE_SWARM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FEED_THE_SWARM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
