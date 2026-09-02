// `Plunge into Winter` — the target creature is tapped, a scry 1 is asked
// with one card shown, and the draw follows the answer; zero targets still
// scries and draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { PLUNGE_INTO_WINTER_SCRIPT } from './plungeIntoWinter';
import { PLUNGE_INTO_WINTER } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Plunge into Winter';
const BEARS = 'Grizzly Bears';

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

function answerScry(g: Game): number {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [...revealed], toBottom: [] }));
  return revealed.length;
}

function aimed(): { g: Game; spell: InstanceId; bears: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS]],
    scripts: createRegistry([PLUNGE_INTO_WINTER_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, spell, bears, logAt };
}

describe('Plunge into Winter (up to one target)', () => {
  test('one target: tapped, one card shown to the scry, then a draw', () => {
    const { g, bears, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    expect(answerScry(g)).toBe(1);
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('zero targets: still the scry and the draw, no fizzle', () => {
    const { g, spell, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    expect(answerScry(g)).toBe(1);
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = PLUNGE_INTO_WINTER.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, PLUNGE_INTO_WINTER.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(PLUNGE_INTO_WINTER.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, bears } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    answerScry(g);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
