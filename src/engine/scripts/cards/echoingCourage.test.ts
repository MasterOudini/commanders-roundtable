// `Echoing Courage` — both same-name Bears read 4/4; the Dreadmaw is
// untouched; cleanup ends it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ECHOING_COURAGE_SCRIPT } from './echoingCourage';
import { ECHOING_COURAGE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function braved(): { g: Game; a: InstanceId; b: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Echoing Courage', 'Grizzly Bears'],
      ['Grizzly Bears', 'Colossal Dreadmaw'],
    ],
    scripts: createRegistry([ECHOING_COURAGE_SCRIPT]),
  });
  const a = put(g, 'p1', 'Grizzly Bears');
  const b = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Echoing Courage', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }] }));
  settle(g);
  return { g, a, b, maw };
}

describe('Echoing Courage', () => {
  test('both same-name Bears read 4 power; the Dreadmaw is untouched; cleanup ends it', () => {
    const { g, a, b, maw } = braved();
    expect(derive(g.state, ORACLE, g.deps.scripts, a).power).toBe(4);
    expect(derive(g.state, ORACLE, g.deps.scripts, b).power).toBe(4);
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).power).toBe(6);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, a).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ECHOING_COURAGE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ECHOING_COURAGE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ECHOING_COURAGE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = braved();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
