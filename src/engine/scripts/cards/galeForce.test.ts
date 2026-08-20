// `Gale Force` — 5 damage to each creature with flying, whoever controls
// it; grounded creatures are untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GALE_FORCE_SCRIPT } from './galeForce';
import { GALE_FORCE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blown(): { g: Game; mine: InstanceId; theirs: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Gale Force', 'Baleful Strix'], ['Baleful Strix', 'Grizzly Bears']],
    scripts: createRegistry([GALE_FORCE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Baleful Strix');
  const theirs = put(g, 'p2', 'Baleful Strix');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Gale Force', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, bears };
}

describe('Gale Force', () => {
  test('both flyers die — mine included — and the grounded Bears is untouched', () => {
    const { g, mine, theirs, bears } = blown();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.damage).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GALE_FORCE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GALE_FORCE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GALE_FORCE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = blown();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
