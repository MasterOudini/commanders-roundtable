// `Martyr's Cry` — the white creatures on BOTH sides exile and each
// controller draws for their own.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MARTYRS_CRY_SCRIPT } from './martyrsCry';
import { MARTYR_S_CRY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cried(): {
  g: Game;
  mine: InstanceId;
  theirs: InstanceId;
  bears: InstanceId;
  myHand: number;
  theirHand: number;
} {
  const g = startedGame({
    players: 2,
    decks: [
      ["Martyr's Cry", 'Aysen Bureaucrats'],
      ['Aysen Bureaucrats', 'Grizzly Bears'],
    ],
    scripts: createRegistry([MARTYRS_CRY_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Aysen Bureaucrats');
  const theirs = put(g, 'p2', 'Aysen Bureaucrats');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Martyr's Cry", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const myHand = (g.state.zones.hand['p1'] ?? []).length;
  const theirHand = (g.state.zones.hand['p2'] ?? []).length;
  settle(g);
  return { g, mine, theirs, bears, myHand, theirHand };
}

describe("Martyr's Cry", () => {
  test('both white creatures exile; each controller draws one; the green 2/2 stands', () => {
    const { g, mine, theirs, bears, myHand, theirHand } = cried();
    expect(g.state.cards[mine]?.zone.kind).toBe('exile');
    expect(g.state.cards[theirs]?.zone.kind).toBe('exile');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(myHand + 1);
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(theirHand + 1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MARTYR_S_CRY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MARTYR_S_CRY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MARTYR_S_CRY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cried();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
