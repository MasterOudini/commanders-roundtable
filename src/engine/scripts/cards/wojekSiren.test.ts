// `Wojek Siren` — RADIANCE. The prefix is an ability word with no rules
// meaning, and the probe confirmed the clause parses to ONE target creature;
// the spread is resolve-side.
//
// The three branches that matter: a creature sharing a colour is pumped, one
// sharing none is not, and a COLOURLESS target pumps alone.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WOJEK_SIREN_SCRIPT } from './wojekSiren';
import { WOJEK_SIREN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { parseTargetClauses } from '../../../data/targetParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Wojek Siren';
const GREEN = 'Grizzly Bears'; // G
const GREEN2 = 'Llanowar Elves'; // G — shares with the target
const WHITE = 'Silvercoat Lion'; // W — shares nothing with green

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; target: InstanceId; sharer: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, GREEN, GREEN2, WHITE],
      [],
    ],
    scripts: createRegistry([WOJEK_SIREN_SCRIPT]),
  });
  const target = put(g, 'p1', GREEN);
  const sharer = put(g, 'p1', GREEN2);
  const other = put(g, 'p1', WHITE);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return { g, target, sharer, other };
}

function power(g: Game, id: InstanceId): number | null {
  const d = deps(createRegistry([WOJEK_SIREN_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).power;
}

describe('Wojek Siren', () => {
  test('the RADIANCE prefix does not confuse the aim — one target creature', () => {
    const specs = parseTargetClauses(WOJEK_SIREN.faces[0]?.oracleText ?? '');
    expect(specs).toHaveLength(1);
    expect(specs[0]?.kinds).toEqual(['creature']);
    expect(specs[0]?.max).toBe(1);
  });

  test('the target and every colour-sharer are pumped', () => {
    const { g, target, sharer } = cast();
    expect(power(g, target)).toBe(3); // 2/2 -> 3/3
    expect(power(g, sharer)).toBe(2); // 1/1 -> 2/2
  });

  test('a creature sharing NO colour is untouched', () => {
    const { g, other } = cast();
    expect(power(g, other)).toBe(2); // Silvercoat Lion stays 2/2
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WOJEK_SIREN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WOJEK_SIREN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WOJEK_SIREN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
