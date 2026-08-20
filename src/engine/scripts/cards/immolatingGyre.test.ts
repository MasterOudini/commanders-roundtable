// `Immolating Gyre` — two spells in my graveyard make X = 2: their 2/2
// dies, MY creature is exempt.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { IMMOLATING_GYRE_SCRIPT } from './immolatingGyre';
import { IMMOLATING_GYRE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function whirled(): { g: Game; theirs: InstanceId; mine: InstanceId; big: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Immolating Gyre', 'Heat Ray', 'Infest', 'Grizzly Bears'],
      ['Grizzly Bears', 'Colossal Dreadmaw'],
    ],
    scripts: createRegistry([IMMOLATING_GYRE_SCRIPT]),
  });
  put(g, 'p1', 'Heat Ray', 'graveyard');
  put(g, 'p1', 'Infest', 'graveyard');
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  const big = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Immolating Gyre', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, theirs, mine, big };
}

describe('Immolating Gyre', () => {
  test('X = 2 off my two dead spells: their 2/2 dies, the 6/6 carries 2, mine is exempt', () => {
    const { g, theirs, mine, big } = whirled();
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[big]?.damage).toBe(2);
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[mine]?.damage).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = IMMOLATING_GYRE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, IMMOLATING_GYRE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(IMMOLATING_GYRE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = whirled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
