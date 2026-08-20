// `Hope and Glory` — both picks stand up and both read 3/3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HOPE_AND_GLORY_SCRIPT } from './hopeAndGlory';
import { HOPE_AND_GLORY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rallied(): { g: Game; a: InstanceId; b: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Hope and Glory', 'Grizzly Bears', 'Grizzly Bears'], []],
    scripts: createRegistry([HOPE_AND_GLORY_SCRIPT]),
  });
  const a = put(g, 'p1', 'Grizzly Bears');
  const b = put(g, 'p1', 'Grizzly Bears');
  expect(b).not.toBe(a);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [a, b], tapped: true }));
  const spell = put(g, 'p1', 'Hope and Glory', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: a },
        { kind: 'card', id: b },
      ],
    }),
  );
  settle(g);
  return { g, a, b };
}

describe('Hope and Glory', () => {
  test('both tapped picks stand up as 3/3s; cleanup keeps the untap', () => {
    const { g, a, b } = rallied();
    expect(g.state.cards[a]?.tapped).toBe(false);
    expect(g.state.cards[b]?.tapped).toBe(false);
    expect(derive(g.state, ORACLE, g.deps.scripts, a).power).toBe(3);
    expect(derive(g.state, ORACLE, g.deps.scripts, b).power).toBe(3);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, a).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HOPE_AND_GLORY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HOPE_AND_GLORY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HOPE_AND_GLORY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = rallied();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
