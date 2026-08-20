// `Consume the Meek` — the mana-value wipe: MV 2 dies, MV 6 stands, and
// the caster's own cheap creature goes with the rest.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CONSUME_THE_MEEK_SCRIPT } from './consumeTheMeek';
import { CONSUME_THE_MEEK } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function consumed(): { g: Game; mine: InstanceId; theirs: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Consume the Meek', 'Llanowar Elves'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([CONSUME_THE_MEEK_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Llanowar Elves');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Consume the Meek', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, maw };
}

describe('Consume the Meek', () => {
  test('MV ≤3 dies on BOTH sides; the 6-drop stands', () => {
    const { g, mine, theirs, maw } = consumed();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CONSUME_THE_MEEK.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CONSUME_THE_MEEK.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CONSUME_THE_MEEK.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = consumed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
