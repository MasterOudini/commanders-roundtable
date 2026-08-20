// `Citywide Bust` — the numeric wipe: toughness 6 dies, toughness 2
// stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CITYWIDE_BUST_SCRIPT } from './citywideBust';
import { CITYWIDE_BUST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function busted(): { g: Game; maw: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Citywide Bust'], ['Colossal Dreadmaw', 'Grizzly Bears']],
    scripts: createRegistry([CITYWIDE_BUST_SCRIPT]),
  });
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Citywide Bust', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, maw, bears };
}

describe('Citywide Bust', () => {
  test('toughness 6 dies; toughness 2 stands', () => {
    const { g, maw, bears } = busted();
    expect(g.state.cards[maw]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CITYWIDE_BUST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CITYWIDE_BUST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CITYWIDE_BUST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = busted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
