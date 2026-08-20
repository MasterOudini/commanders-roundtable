// `Hurricane` — X = 2: the flyer dies, both players bleed, the ground
// creature never notices.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HURRICANE_SCRIPT } from './hurricane';
import { HURRICANE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blown(): { g: Game; strix: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Hurricane'], ['Baleful Strix', 'Grizzly Bears']],
    scripts: createRegistry([HURRICANE_SCRIPT]),
  });
  const strix = put(g, 'p2', 'Baleful Strix');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Hurricane', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  settle(g);
  return { g, strix, bears };
}

describe('Hurricane', () => {
  test('X = 2: the flyer dies, both players take 2, the Bears stands clean', () => {
    const { g, strix, bears } = blown();
    expect(g.state.cards[strix]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.damage).toBe(0);
    expect(g.state.players['p1']?.life).toBe(38);
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HURRICANE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HURRICANE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HURRICANE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = blown();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
