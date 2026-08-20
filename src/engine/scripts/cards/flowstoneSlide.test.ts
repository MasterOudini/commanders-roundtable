// `Flowstone Slide` — X = 2: the 2/2 becomes 4/0 and dies to the SBA; the
// 6/6 stands at 8/4.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FLOWSTONE_SLIDE_SCRIPT } from './flowstoneSlide';
import { FLOWSTONE_SLIDE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function slid(): { g: Game; bears: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Flowstone Slide'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([FLOWSTONE_SLIDE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Flowstone Slide', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  settle(g);
  return { g, bears, maw };
}

describe('Flowstone Slide', () => {
  test('X = 2: the 2/2 dies to zero toughness; the 6/6 reads 8/4', () => {
    const { g, bears, maw } = slid();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).power).toBe(8);
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).toughness).toBe(4);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FLOWSTONE_SLIDE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FLOWSTONE_SLIDE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FLOWSTONE_SLIDE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = slid();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
