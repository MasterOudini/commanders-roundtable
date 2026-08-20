// `Enrage` — X = 3 makes the 2/2 read 5 power, toughness untouched;
// cleanup ends it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ENRAGE_SCRIPT } from './enrage';
import { ENRAGE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function enraged(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Enrage', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([ENRAGE_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Enrage', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 3 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Enrage', () => {
  test('X = 3: the 2/2 reads 5/2, and cleanup ends it', () => {
    const { g, bears } = enraged();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(5);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).toughness).toBe(2);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ENRAGE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ENRAGE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ENRAGE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = enraged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
