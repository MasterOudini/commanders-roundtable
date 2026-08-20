// `End the Festivities` — the opponent and their 1/1 take 1; the caster
// and the caster's own 1/1 are untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { END_THE_FESTIVITIES_SCRIPT } from './endTheFestivities';
import { END_THE_FESTIVITIES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function festivitiesEnded(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['End the Festivities', 'Baleful Strix'], ['Baleful Strix']],
    scripts: createRegistry([END_THE_FESTIVITIES_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Baleful Strix');
  const theirs = put(g, 'p2', 'Baleful Strix');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'End the Festivities', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs };
}

describe('End the Festivities', () => {
  test('the opponent and their 1/1 take 1; my side is untouched', () => {
    const { g, mine, theirs } = festivitiesEnded();
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = END_THE_FESTIVITIES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, END_THE_FESTIVITIES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(END_THE_FESTIVITIES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = festivitiesEnded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
