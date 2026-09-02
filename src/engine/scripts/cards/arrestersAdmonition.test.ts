// `Arrester's Admonition` — the bounce always; the Addendum draw only when
// the spell is cast in MY main phase, measured against a cast in the
// opponent's main phase, where it resolves without a draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ARRESTERS_ADMONITION_SCRIPT } from './arrestersAdmonition';
import { ARRESTER_S_ADMONITION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = "Arrester's Admonition";
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player),
    ).length;
}

function cast(when: 'myMain' | 'theirMain'): { g: Game; bears: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS]],
    scripts: createRegistry([ARRESTERS_ADMONITION_SCRIPT]),
  });
  const bears = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  if (when === 'myMain') {
    advanceUntil(
      g,
      (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null,
      60_000,
    );
  } else {
    advanceUntil(
      g,
      (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null,
      60_000,
    );
  }
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, logAt };
}

describe("Arrester's Admonition", () => {
  test('cast in my main phase: the creature is bounced and I draw', () => {
    const { g, bears, logAt } = cast('myMain');
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'hand', player: 'p2' });
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test("cast in the opponent's main phase: bounced, no draw", () => {
    const { g, bears, logAt } = cast('theirMain');
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'hand', player: 'p2' });
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ARRESTER_S_ADMONITION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ARRESTER_S_ADMONITION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ARRESTER_S_ADMONITION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast('myMain');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
