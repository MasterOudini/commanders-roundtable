// `Vampiric Touch` — 2 at an opponent and 2 onto me, with the CASTER'S OWN
// face refused: the probe showed the opponent restriction is enforced.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { VAMPIRIC_TOUCH_SCRIPT } from './vampiricTouch';
import { VAMPIRIC_TOUCH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Vampiric Touch';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): Game {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([VAMPIRIC_TOUCH_SCRIPT]),
  });
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return g;
}

describe('Vampiric Touch', () => {
  test('2 off the opponent and 2 onto me', () => {
    const g = cast();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players.p2?.life).toBe(38);
    expect(g.state.players.p1?.life).toBe(42);
  });

  test('MYSELF is refused — the clause says target OPPONENT', () => {
    const g = cast();
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p1' }] });
    expect(res.ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = VAMPIRIC_TOUCH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, VAMPIRIC_TOUCH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(VAMPIRIC_TOUCH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = cast();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
