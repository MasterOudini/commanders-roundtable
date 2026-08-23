// `Virtue's Ruin` — the colour wipe. White dies whoever controls it; green
// does not; and the colour is read DERIVED, not off the printed line.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { VIRTUES_RUIN_SCRIPT } from './virtuesRuin';
import { VIRTUE_S_RUIN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = "Virtue's Ruin";
const WHITE = 'Silvercoat Lion'; // W
const GREEN = 'Grizzly Bears'; // G

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; mineWhite: InstanceId; theirWhite: InstanceId; green: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, WHITE],
      [WHITE, GREEN],
    ],
    scripts: createRegistry([VIRTUES_RUIN_SCRIPT]),
  });
  const mineWhite = put(g, 'p1', WHITE);
  const theirWhite = put(g, 'p2', WHITE);
  const green = put(g, 'p2', GREEN);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mineWhite, theirWhite, green };
}

describe("Virtue's Ruin", () => {
  test('every white creature dies, MINE included', () => {
    const { g, mineWhite, theirWhite } = cast();
    expect(g.state.cards[mineWhite]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirWhite]?.zone.kind).toBe('graveyard');
  });

  test('a green creature is untouched', () => {
    const { g, green } = cast();
    expect(g.state.cards[green]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = VIRTUE_S_RUIN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, VIRTUE_S_RUIN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(VIRTUE_S_RUIN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
