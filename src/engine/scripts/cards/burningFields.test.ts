// `Burning Fields` — 5 at target OPPONENT (the compound's player arm); the
// caster is not a legal target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BURNING_FIELDS_SCRIPT } from './burningFields';
import { BURNING_FIELDS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Burning Fields'], ['Grizzly Bears']],
    scripts: createRegistry([BURNING_FIELDS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Burning Fields', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return g;
}

describe('Burning Fields', () => {
  test('the opponent takes 5', () => {
    const g = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(35);
  });

  test('the CASTER is refused — opponent means opponent', () => {
    const g = armed();
    const verdict = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p1' }] });
    expect(verdict.ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BURNING_FIELDS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BURNING_FIELDS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BURNING_FIELDS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
