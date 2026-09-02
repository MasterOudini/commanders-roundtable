// `Wit's End` — the WHOLE hand goes, with no ask raised at all. That absence
// is the point: batch-mate `Wistful Thinking` discards a COUNT and must ask;
// this one discards a hand and must not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WITS_END_SCRIPT } from './witsEnd';
import { WIT_S_END } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = "Wit's End";
const FILLER = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; theirHandBefore: number; myHandBefore: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [FILLER, FILLER, FILLER]],
    scripts: createRegistry([WITS_END_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 9 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const theirHandBefore = idsIn(g, 'p2', 'hand').length;
  const myHandBefore = idsIn(g, 'p1', 'hand').length;
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, theirHandBefore, myHandBefore };
}

describe("Wit's End", () => {
  test('their hand is emptied into the graveyard, and NO ask is raised', () => {
    const { g, theirHandBefore } = cast();
    expect(theirHandBefore).toBeGreaterThan(0);
    expect(idsIn(g, 'p2', 'hand')).toHaveLength(0);
    expect(idsIn(g, 'p2', 'graveyard').length).toBeGreaterThanOrEqual(theirHandBefore);
    expect(g.state.priority.awaiting).toBe(null);
  });

  test('MY hand is untouched', () => {
    const { g, myHandBefore } = cast();
    expect(idsIn(g, 'p1', 'hand').length).toBe(myHandBefore);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WIT_S_END.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WIT_S_END.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WIT_S_END.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
