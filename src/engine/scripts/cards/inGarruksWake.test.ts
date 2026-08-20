// `In Garruk's Wake` — everything I don't control dies; my board and the
// indestructible bystander never notice.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { IN_GARRUKS_WAKE_SCRIPT } from './inGarruksWake';
import { IN_GARRUK_S_WAKE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function woken(): { g: Game; theirs: InstanceId; myr: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["In Garruk's Wake", 'Grizzly Bears'], ['Colossal Dreadmaw', 'Darksteel Myr']],
    scripts: createRegistry([IN_GARRUKS_WAKE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Colossal Dreadmaw');
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "In Garruk's Wake", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 7 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, theirs, myr, mine };
}

describe("In Garruk's Wake", () => {
  test('their 6/6 dies; my 2/2 and their indestructible Myr stand', () => {
    const { g, theirs, myr, mine } = woken();
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = IN_GARRUK_S_WAKE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, IN_GARRUK_S_WAKE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(IN_GARRUK_S_WAKE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = woken();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
