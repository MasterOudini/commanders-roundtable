// `Might of the Masses` — three creatures make the target +3/+3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MIGHT_OF_THE_MASSES_SCRIPT } from './mightOfTheMasses';
import { MIGHT_OF_THE_MASSES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function massed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Might of the Masses', 'Grizzly Bears', 'Aysen Bureaucrats', 'Aysen Bureaucrats'],
      [],
    ],
    scripts: createRegistry([MIGHT_OF_THE_MASSES_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const a = put(g, 'p1', 'Aysen Bureaucrats');
  const b = put(g, 'p1', 'Aysen Bureaucrats');
  if (a === b) throw new Error('the deck padded away the second Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Might of the Masses', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }),
  );
  settle(g);
  return { g, bears };
}

describe('Might of the Masses', () => {
  test('three creatures make the Bears 5/5', () => {
    const { g, bears } = massed();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(5);
    expect(d.toughness).toBe(5);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MIGHT_OF_THE_MASSES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MIGHT_OF_THE_MASSES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MIGHT_OF_THE_MASSES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = massed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
