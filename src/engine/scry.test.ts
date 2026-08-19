// D195 — scry and surveil as effects: the second and third effect kinds
// whose resolution can stop and ask. The prompt ships NO card ids (the
// fourth hidden-zone prompt, D137's rule), the answer is validated as an
// exact partition, and the `thenDraw` rider is emitted against the library
// AS REORDERED — drawing the card the player just kept is the whole point
// of Preordain, and the test proves it from both answers.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('the scry vocabulary (D195)', () => {
  test('the bare forms are understood', () => {
    expect(parseEffects('Scry 2.', 'Test Card', true).mode).toBe('auto');
    expect(parseEffects('Surveil 2.', 'Test Card', true).mode).toBe('auto');
  });

  test('the comma-form carries the draw INSIDE the spec — Preordain', () => {
    const p = parseEffects('Scry 2, then draw a card.', 'Preordain', true);
    expect(p.mode).toBe('auto');
    expect(p.effects).toHaveLength(1);
    expect(p.effects[0]?.kind).toBe('scry');
    expect(p.effects[0]?.amount).toBe(2);
    expect(p.effects[0]?.thenDraw).toBe(1);
  });

  test('the window-form joins two printed lines — Opt, Consider', () => {
    const opt = parseEffects('Scry 1.\nDraw a card.', 'Opt', true);
    expect(opt.mode).toBe('auto');
    expect(opt.effects).toHaveLength(1);
    expect(opt.effects[0]?.thenDraw).toBe(1);
    const consider = parseEffects('Surveil 1.\nDraw a card.', 'Consider', true);
    expect(consider.mode).toBe('auto');
    expect(consider.effects[0]?.kind).toBe('surveil');
  });

  test('an effect that asks must be LAST, or the card never runs by itself', () => {
    // "Scry 1. Destroy target artifact." would scry and silently drop the
    // destroy — half-execution while every sentence reads as understood.
    // The guard lands it assisted instead.
    const p = parseEffects('Scry 1.\nDestroy target artifact.', 'Test Card', true);
    expect(p.mode).not.toBe('auto');
  });
});

describe('the scry in play (D195)', () => {
  function cast(spell: string): { g: Game; revealed: InstanceId; under: InstanceId } {
    const g = startedGame({ players: 2, decks: [[spell, 'Grizzly Bears'], ['Grizzly Bears']] });
    const card = put(g, 'p1', spell, 'hand');
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib[lib.length - 1] as InstanceId;
    const under = lib[lib.length - 2] as InstanceId;
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    return { g, revealed, under };
  }

  test('the prompt carries NO card ids — count, destination, rider, nothing else', () => {
    const { g } = cast('Opt');
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(Object.keys(awaiting ?? {}).sort()).toEqual([
      'count', 'kind', 'label', 'player', 'thenDraw', 'toGraveyard',
    ]);
  });

  test('bottom it, and the draw takes the card UNDERNEATH — the reorder is seen', () => {
    const { g, revealed, under } = cast('Opt');
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [revealed] }));
    settle(g);
    // The bottomed card is index 0 (the top is the END of the array, D141).
    expect(g.state.zones.library['p1']?.[0]).toBe(revealed);
    expect(g.state.cards[under]?.zone.kind).toBe('hand');
    expect(g.state.cards[revealed]?.zone.kind).toBe('library');
  });

  test('keep it, and the draw takes exactly it', () => {
    const { g, revealed } = cast('Opt');
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [revealed], toBottom: [] }));
    settle(g);
    expect(g.state.cards[revealed]?.zone.kind).toBe('hand');
  });

  test('a surveil sends the reject to the GRAVEYARD, then draws', () => {
    const { g, revealed, under } = cast('Consider');
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [revealed] }));
    settle(g);
    expect(g.state.cards[revealed]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[under]?.zone.kind).toBe('hand');
  });

  test('a short answer is rejected — the partition must be exact', () => {
    const { g } = cast('Opt');
    const result = g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [] });
    expect(result.ok).toBe(false);
  });

  test('replays to the same hash with a scry on the log', () => {
    const { g, revealed } = cast('Opt');
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [revealed] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
