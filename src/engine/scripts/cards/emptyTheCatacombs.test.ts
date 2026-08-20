// `Empty the Catacombs` — every player's dead creatures come back to
// hand; the lands stay buried.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { EMPTY_THE_CATACOMBS_SCRIPT } from './emptyTheCatacombs';
import { EMPTY_THE_CATACOMBS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function emptied(): { g: Game; mine: InstanceId; theirs: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Empty the Catacombs', 'Grizzly Bears'],
      ['Grizzly Bears', 'Mountain'],
    ],
    scripts: createRegistry([EMPTY_THE_CATACOMBS_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears', 'graveyard');
  const theirs = put(g, 'p2', 'Grizzly Bears', 'graveyard');
  const land = put(g, 'p2', 'Mountain', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Empty the Catacombs', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, land };
}

describe('Empty the Catacombs', () => {
  test('both dead creatures return to their owners\' hands; the land stays', () => {
    const { g, mine, theirs, land } = emptied();
    expect(g.state.cards[mine]?.zone.kind).toBe('hand');
    expect(g.state.cards[theirs]?.zone.kind).toBe('hand');
    expect((g.state.zones.hand['p2'] ?? []).includes(theirs)).toBe(true);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = EMPTY_THE_CATACOMBS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, EMPTY_THE_CATACOMBS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(EMPTY_THE_CATACOMBS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = emptied();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
