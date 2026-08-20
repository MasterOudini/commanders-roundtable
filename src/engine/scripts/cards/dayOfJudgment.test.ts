// `Day of Judgment` — every creature in one move; indestructible stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DAY_OF_JUDGMENT_SCRIPT } from './dayOfJudgment';
import { DAY_OF_JUDGMENT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function judged(): { g: Game; bears: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Day of Judgment'], ['Grizzly Bears', 'Darksteel Myr']],
    scripts: createRegistry([DAY_OF_JUDGMENT_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Day of Judgment', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, myr };
}

describe('Day of Judgment', () => {
  test('the Bears die; Darksteel Myr stands (CR 701.7b)', () => {
    const { g, bears, myr } = judged();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DAY_OF_JUDGMENT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DAY_OF_JUDGMENT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DAY_OF_JUDGMENT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = judged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
