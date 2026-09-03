// `Donatello's Science Lesson` — a creature and two players answer two
// different clauses; zero targets is a legal cast that resolves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DONATELLOS_SCIENCE_LESSON_SCRIPT } from './donatellosScienceLesson';
import { DONATELLO_S_SCIENCE_LESSON } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = "Donatello's Science Lesson";
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

function aimed(): { g: Game; spell: InstanceId; theirs: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS]],
    scripts: createRegistry([DONATELLOS_SCIENCE_LESSON_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, spell, theirs, logAt };
}

describe("Donatello's Science Lesson (two up-to clauses)", () => {
  test('their bear is tapped and both players draw', () => {
    const { g, theirs, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }, { kind: 'player', id: 'p1' }, { kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(drawsFor(g, 'p2', logAt)).toBe(1);
  });

  test('players only: the clause that got no creature still resolves', () => {
    const { g, theirs, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(g.state.cards[theirs]?.tapped).toBe(false);
    expect(drawsFor(g, 'p2', logAt)).toBe(1);
  });

  test('zero targets: resolves without fizzling', () => {
    const { g, spell, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DONATELLO_S_SCIENCE_LESSON.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DONATELLO_S_SCIENCE_LESSON.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DONATELLO_S_SCIENCE_LESSON.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, theirs } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }, { kind: 'player', id: 'p1' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
