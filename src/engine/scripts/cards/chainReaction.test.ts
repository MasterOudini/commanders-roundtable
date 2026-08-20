// `Chain Reaction` — X = ALL creatures: three on the board deal 3 to each;
// the 2/2s die and the 6/6 keeps 3 marked.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CHAIN_REACTION_SCRIPT } from './chainReaction';
import { CHAIN_REACTION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function chained(): { g: Game; mine: InstanceId; theirs: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Chain Reaction', 'Grizzly Bears'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([CHAIN_REACTION_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Chain Reaction', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, maw };
}

describe('Chain Reaction', () => {
  test('X=3 kills both 2/2s — MINE included — and marks the 6/6 for 3', () => {
    const { g, mine, theirs, maw } = chained();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[maw]?.damage).toBe(3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CHAIN_REACTION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CHAIN_REACTION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CHAIN_REACTION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = chained();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
