// D336 - "This spell can't be countered." A claim on the card script that the
// replacement funnel reads: a counter's events - the `SpellCountered` and the
// move off the stack - never apply to the spell, whichever code emitted them,
// and a line says so. Carnage Tyrant against Counterspell; a Grizzly Bears in
// the same seat is still countered; and the funnel alone, handed the batch a
// counter script emits itself.
import { describe, expect, test } from 'vitest';
import { createRegistry } from './scripts/registryCore';
import { CARNAGE_TYRANT_SCRIPT } from './scripts/cards/carnageTyrant';
import { runReplacementFunnel } from './triggers';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { EventBody } from './types/events';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function mana(g: Game, player: 'p1' | 'p2', symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: number): void {
  must(g.submit({ t: 'ManualAddMana', player, target: player, symbol, amount }));
}

/** p1 casts `name` at its third-turn main phase; p2 holds priority with the spell on the stack, a Counterspell in hand and {U}{U}. */
function onTheStack(name: 'Carnage Tyrant' | 'Grizzly Bears'): { g: Game; spell: InstanceId; counter: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Carnage Tyrant', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass', 'Counterspell']],
    scripts: createRegistry([CARNAGE_TYRANT_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const spell = put(g, 'p1', name, 'hand');
  const counter = put(g, 'p2', 'Counterspell', 'hand');
  if (name === 'Carnage Tyrant') {
    mana(g, 'p1', 'G', 2);
    mana(g, 'p1', 'C', 4);
  } else {
    mana(g, 'p1', 'G', 1);
    mana(g, 'p1', 'C', 1);
  }
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.player === 'p2' && s.priority.awaiting === null && s.stack.length === 1, 20_000);
  mana(g, 'p2', 'U', 2);
  return { g, spell, counter };
}
function counterIt(g: Game, counter: InstanceId): void {
  const top = g.state.stack[0];
  if (!top) throw new Error('nothing on the stack');
  must(g.submit({ t: 'CastSpell', player: 'p2', card: counter, targets: [{ kind: 'stack', id: top.id }] }));
  settle(g);
}
const said = (g: Game, text: string): boolean => g.log.some((e) => e.body.t === 'Narrated' && e.body.text.includes(text));

describe("D336 - can't be countered", () => {
  test('Counterspell resolves against Carnage Tyrant and does nothing; the Tyrant enters and the log says why', () => {
    const { g, spell, counter } = onTheStack('Carnage Tyrant');
    counterIt(g, counter);
    expect(g.state.cards[spell]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[counter]?.zone.kind).toBe('graveyard');
    expect(g.state.stack).toHaveLength(0);
    expect(said(g, "Carnage Tyrant can't be countered.")).toBe(true);
    expect(said(g, 'counters Carnage Tyrant')).toBe(false);
  });

  test('a Grizzly Bears from the same seat is still countered', () => {
    const { g, spell, counter } = onTheStack('Grizzly Bears');
    counterIt(g, counter);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[counter]?.zone.kind).toBe('graveyard');
    expect(said(g, 'counters Grizzly Bears')).toBe(true);
  });

  test('the funnel drops a counter a script emits itself, and the move off the stack with it', () => {
    const { g, spell } = onTheStack('Carnage Tyrant');
    const top = g.state.stack[0];
    if (!top) throw new Error('nothing on the stack');
    const batch: EventBody[] = [
      { t: 'SpellCountered', stackId: top.id },
      { t: 'CardsMoved', moves: [{ card: spell, from: { kind: 'stack', player: null }, to: { kind: 'graveyard', player: 'p1' } }] },
    ];
    const r = runReplacementFunnel(g.state, g.deps.oracle, g.deps.scripts, batch);
    expect(r.kind).toBe('done');
    if (r.kind !== 'done') return;
    expect(r.events.map((e) => e.t)).toEqual(['Narrated']);
    const line = r.events[0];
    expect(line?.t === 'Narrated' ? line.text : '').toBe("Carnage Tyrant can't be countered.");
  });

  test('the same batch for a Grizzly Bears passes through untouched', () => {
    const { g, spell } = onTheStack('Grizzly Bears');
    const top = g.state.stack[0];
    if (!top) throw new Error('nothing on the stack');
    const batch: EventBody[] = [
      { t: 'SpellCountered', stackId: top.id },
      { t: 'CardsMoved', moves: [{ card: spell, from: { kind: 'stack', player: null }, to: { kind: 'graveyard', player: 'p1' } }] },
    ];
    const r = runReplacementFunnel(g.state, g.deps.oracle, g.deps.scripts, batch);
    expect(r.kind).toBe('done');
    if (r.kind !== 'done') return;
    expect(r.events.map((e) => e.t)).toEqual(['SpellCountered', 'CardsMoved']);
  });
});
