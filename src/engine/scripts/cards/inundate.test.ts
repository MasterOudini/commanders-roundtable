// `Inundate` — the green creatures go home on both sides; the blue-black
// flyer stays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INUNDATE_SCRIPT } from './inundate';
import { INUNDATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function flooded(): { g: Game; mine: InstanceId; theirs: InstanceId; strix: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Inundate', 'Elvish Herder'], ['Grizzly Bears', 'Baleful Strix']],
    scripts: createRegistry([INUNDATE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Elvish Herder');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  const strix = put(g, 'p2', 'Baleful Strix');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Inundate', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, strix };
}

describe('Inundate', () => {
  test('the nonblue creatures bounce to their owners; the blue Strix stays', () => {
    const { g, mine, theirs, strix } = flooded();
    expect((g.state.zones.hand['p1'] ?? []).includes(mine)).toBe(true);
    expect((g.state.zones.hand['p2'] ?? []).includes(theirs)).toBe(true);
    expect(g.state.cards[strix]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INUNDATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INUNDATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INUNDATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = flooded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
