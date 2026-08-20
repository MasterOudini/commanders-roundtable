// `Hard-Hitting Question` — Bite Down's text on its own id: my 6/6 bites
// their 2/2 one way only.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HARD_HITTING_QUESTION_SCRIPT } from './hardHittingQuestion';
import { HARD_HITTING_QUESTION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function questioned(): { g: Game; dreadmaw: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Hard-Hitting Question', 'Colossal Dreadmaw'], ['Grizzly Bears']],
    scripts: createRegistry([HARD_HITTING_QUESTION_SCRIPT]),
  });
  const dreadmaw = put(g, 'p1', 'Colossal Dreadmaw');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Hard-Hitting Question', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: dreadmaw },
        { kind: 'card', id: bears },
      ],
    }),
  );
  settle(g);
  return { g, dreadmaw, bears };
}

describe('Hard-Hitting Question', () => {
  test('the 6/6 kills the 2/2 and takes nothing back', () => {
    const { g, dreadmaw, bears } = questioned();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[dreadmaw]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[dreadmaw]?.damage).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HARD_HITTING_QUESTION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HARD_HITTING_QUESTION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HARD_HITTING_QUESTION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = questioned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
