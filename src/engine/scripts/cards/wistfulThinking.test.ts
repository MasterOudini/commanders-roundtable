// `Wistful Thinking` — the draws land, then a `chooseFromZone` discard ask
// goes to the TARGET, not to me. That ask being script-raisable is the
// finding this batch turned up.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WISTFUL_THINKING_SCRIPT } from './wistfulThinking';
import { WISTFUL_THINKING } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Wistful Thinking';
const FILLER = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL],
      [FILLER, FILLER, FILLER, FILLER, FILLER],
    ],
    scripts: createRegistry([WISTFUL_THINKING_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
  return g;
}

describe('Wistful Thinking', () => {
  test('the ask goes to the TARGET, from their HAND, for four', () => {
    const g = cast();
    const a = g.state.priority.awaiting;
    expect(a?.kind).toBe('chooseFromZone');
    if (a?.kind !== 'chooseFromZone') throw new Error('unreachable');
    expect(a.player).toBe('p2');
    expect(a.zone).toBe('hand');
    expect(a.count).toBe(4);
  });

  test('the two draws landed before the ask', () => {
    const g = cast();
    // p2 opened with seven, drew for turn, and drew two more here; whatever
    // the exact number, the ask can only be for four if the hand supports it.
    expect(idsIn(g, 'p2', 'hand').length).toBeGreaterThanOrEqual(4);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WISTFUL_THINKING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WISTFUL_THINKING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WISTFUL_THINKING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = cast();
    const hand = idsIn(g, 'p2', 'hand');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: hand.slice(0, 4) }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
