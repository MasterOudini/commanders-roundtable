// `Unhinge` — the opponent chooses the card they discard and I draw; an
// opponent with no hand is asked nothing and I still draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { UNHINGE_SCRIPT } from './unhinge';
import { UNHINGE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Unhinge';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function asksSince(g: Game, from: number): number {
  return g.log
    .slice(from)
    .filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting !== null && e.body.awaiting.kind === 'chooseFromZone').length;
}

function cast(emptyTheirHand: boolean): { g: Game; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([UNHINGE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  if (emptyTheirHand) {
    for (const id of idsIn(g, 'p2', 'hand')) {
      must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: id, to: { kind: 'graveyard', player: 'p2' } }));
    }
  }
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  return { g, logAt };
}

describe('Unhinge', () => {
  test('the opponent chooses the card they discard, and I draw', () => {
    const { g, logAt } = cast(false);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const hand = idsIn(g, 'p2', 'hand');
    expect(hand.length).toBeGreaterThan(0);
    const chosen = hand[0] as string;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [chosen] }));
    settle(g);
    expect(g.state.cards[chosen]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(idsIn(g, 'p2', 'hand').length).toBe(hand.length - 1);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('an opponent with no hand is asked nothing; I still draw', () => {
    const { g, logAt } = cast(true);
    settle(g);
    expect(asksSince(g, logAt)).toBe(0);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = UNHINGE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, UNHINGE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(UNHINGE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(false);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const hand = idsIn(g, 'p2', 'hand');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [hand[0] as string] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
