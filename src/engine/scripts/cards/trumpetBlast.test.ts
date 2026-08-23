// `Trumpet Blast` — attacking creatures get +2/+0, cast mid-combat off a
// REAL declaration. A creature that stayed home gets nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TRUMPET_BLAST_SCRIPT } from './trumpetBlast';
import { TRUMPET_BLAST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Trumpet Blast';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blasted(): { g: Game; attacker: InstanceId; homebody: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS, BEARS], []],
    scripts: createRegistry([TRUMPET_BLAST_SCRIPT]),
  });
  const attacker = put(g, 'p1', BEARS);
  const homebody = put(g, 'p1', BEARS);
  expect(attacker).not.toBe(homebody);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: attacker, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  // Now inside combat, with the declaration standing.
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, attacker, homebody };
}

describe('Trumpet Blast', () => {
  test('the attacker gets +2/+0 and the creature that stayed home does not', () => {
    const { g, attacker, homebody } = blasted();
    expect(derive(g.state, ORACLE, g.deps.scripts, attacker).power).toBe(4);
    expect(derive(g.state, ORACLE, g.deps.scripts, attacker).toughness).toBe(2);
    expect(derive(g.state, ORACLE, g.deps.scripts, homebody).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TRUMPET_BLAST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TRUMPET_BLAST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TRUMPET_BLAST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = blasted();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
