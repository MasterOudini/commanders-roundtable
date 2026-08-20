// `Boon of Boseiju` — X is the greatest MANA VALUE among my permanents, and
// the tapped target stands back up.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BOON_OF_BOSEIJU_SCRIPT } from './boonOfBoseiju';
import { BOON_OF_BOSEIJU } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function booned(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    // Colossal Dreadmaw (mv 6) is the greatest mana value on my side.
    decks: [['Boon of Boseiju', 'Colossal Dreadmaw', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([BOON_OF_BOSEIJU_SCRIPT]),
  });
  put(g, 'p1', 'Colossal Dreadmaw');
  const bears = put(g, 'p1', 'Grizzly Bears');
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Boon of Boseiju', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Boon of Boseiju', () => {
  test('X = 6 (the Dreadmaw) and the tapped target stands up', () => {
    const { g, bears } = booned();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(8);
    expect(g.state.cards[bears]?.tapped).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BOON_OF_BOSEIJU.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BOON_OF_BOSEIJU.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BOON_OF_BOSEIJU.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = booned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
