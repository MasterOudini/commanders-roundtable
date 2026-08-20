// `Clear the Land` — planted tops sort exactly: lands to the battlefield
// TAPPED, the rest to exile, everything revealed.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CLEAR_THE_LAND_SCRIPT } from './clearTheLand';
import { CLEAR_THE_LAND } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cleared(): { g: Game; land: InstanceId; spellCard: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Clear the Land', 'Mountain', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([CLEAR_THE_LAND_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  // Plant a KNOWN land on top of MY library.
  const land = put(g, 'p1', 'Mountain', 'hand');
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: land, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
  const spellCard = put(g, 'p1', 'Clear the Land', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spellCard }));
  settle(g);
  return { g, land, spellCard };
}

describe('Clear the Land', () => {
  test('the planted land arrives TAPPED; the ten revealed split land/exile exactly', () => {
    const { g, land } = cleared();
    expect(g.state.cards[land]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[land]?.tapped).toBe(true);
    // Short deck lists pad with BASICS (D200), so most of the ten revealed
    // are lands — every one of them must be on the battlefield TAPPED, and
    // lands + exiles account for all ten.
    const exiled =
      (g.state.zones.exile['p1'] ?? []).length + (g.state.zones.exile['p2'] ?? []).length;
    const tappedLands = g.state.zones.battlefield.filter((id) => g.state.cards[id]?.tapped).length;
    expect(exiled + tappedLands).toBe(10);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CLEAR_THE_LAND.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CLEAR_THE_LAND.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CLEAR_THE_LAND.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cleared();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
