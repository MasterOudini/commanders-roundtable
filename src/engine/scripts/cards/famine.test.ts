// `Famine` — 3 to everything: the 2/2 dies, the 6/6 stands, both players
// take 3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FAMINE_SCRIPT } from './famine';
import { FAMINE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function starved(): { g: Game; bears: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Famine'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([FAMINE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Famine', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, maw };
}

describe('Famine', () => {
  test('3 to each creature and each player', () => {
    const { g, bears, maw } = starved();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(37);
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FAMINE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FAMINE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FAMINE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = starved();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
