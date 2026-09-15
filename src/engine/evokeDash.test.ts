// D449 - EVOKE (CR 702.74) AND DASH (CR 702.109): THE KEYWORD ALTERNATIVE COSTS. "Evoke {cost}" is "you may cast
// this spell by paying {cost} rather than its mana cost; if you do, it's sacrificed when it enters", and "Dash {cost}"
// is the same election with haste and a return to hand at the beginning of the next end step. Both are the face's
// `alternativeCost` with a `keyword` (D408's machinery - the offer, the charge, the client's preview - untouched),
// elected by `CastSpell.alternative`; the resolving spell's `alternativePaid` puts the mark on the permanent
// (`CardInstance.evoked` / `dashed`, riding the entry move like `kicked`); the evoke sacrifice is an ETB trigger in
// the keyword table gated on the mark; the dash return is a delayed trigger armed as the spell resolves (D402),
// its effect the self bounce (a subject gone by then is gone, D373); haste is the derive's. Proven on Mulldrifter
// and Zurgo Bellstriker with NO scripts registered - the printed ETB and static are not what is under proof.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { derive } from './derive';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SCRIPTS = createRegistry([]);

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(SCRIPTS);
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}
function mana(g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
}

describe('D449 - the keyword alternative costs, parsed', () => {
  test('Evoke and Dash read as the face alternative cost with a keyword', () => {
    const m = ORACLE.byName('Mulldrifter')?.faces[0];
    expect(m?.alternativeCost?.keyword).toBe('evoke');
    expect(m?.alternativeCost?.costText).toBe('{2}{U}');
    expect(m?.alternativeCost?.line).toBe('Evoke {2}{U}');
    expect(m?.keywords).toContain('evoke');
    const z = ORACLE.byName('Zurgo Bellstriker')?.faces[0];
    expect(z?.alternativeCost?.keyword).toBe('dash');
    expect(z?.alternativeCost?.costText).toBe('{1}{R}');
    expect(z?.keywords).toContain('dash');
  });
});

function armed(name: string): { g: Game; card: InstanceId } {
  const g = startedGame({ players: 2, decks: [[name], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
  holdEverywhere(g);
  const card = put(g, 'p1', name, 'hand');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, card };
}

describe('D449 - evoke, charged and resolved (Mulldrifter)', () => {
  test('cast for its evoke cost it enters marked and is sacrificed by the keyword trigger', () => {
    const { g, card } = armed('Mulldrifter');
    mana(g, 'C', 2);
    mana(g, 'U', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card, alternative: true }));
    settle(g);
    // The entry move carried the mark (the trigger fired off it and binned the card in the same settle).
    expect(g.log.some((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.card === card && m.to.kind === 'battlefield' && m.altKeyword === 'evoke'))).toBe(true);
    expect(g.state.cards[card]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.card === card && m.reason === 'sacrifice'))).toBe(true);
  });

  test('cast for its mana cost it stays; the evoke cost is refused with too little mana', () => {
    const { g, card } = armed('Mulldrifter');
    mana(g, 'C', 1);
    mana(g, 'U', 1);
    const short = g.submit({ t: 'CastSpell', player: 'p1', card, alternative: true });
    expect(short.ok).toBe(false);
    must(g.submit({ t: 'ManualEmptyPool', player: 'p1', target: 'p1' }));
    mana(g, 'C', 4);
    mana(g, 'U', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[card]?.evoked).toBeUndefined();
  });
});

describe('D449 - dash, charged and resolved (Zurgo Bellstriker)', () => {
  test('cast for its dash cost it has haste, attacks the turn it came, and returns to hand at the end step', () => {
    const { g, card } = armed('Zurgo Bellstriker');
    mana(g, 'C', 1);
    mana(g, 'R', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card, alternative: true }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[card]?.dashed).toBe(true);
    expect(kw(g, card).has('haste')).toBe(true);
    expect(g.state.delayedTriggers.some((d) => d.source === card && d.when.step === 'end')).toBe(true);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' && s.priority.awaiting === null, 20_000);
    expect(g.state.players.p2?.life).toBe(38);
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 20_000);
    expect(g.state.cards[card]?.zone.kind).toBe('hand');
    expect(g.state.cards[card]?.dashed).toBeUndefined();
    expect(g.state.delayedTriggers.some((d) => d.source === card)).toBe(false);
  });

  test('cast for its mana cost it has no haste and stays; a dashed one that died stays dead', () => {
    const { g, card } = armed('Zurgo Bellstriker');
    mana(g, 'R', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    settle(g);
    expect(kw(g, card).has('haste')).toBe(false);
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 20_000);
    expect(g.state.cards[card]?.zone.kind).toBe('battlefield');
    const again = put(g, 'p1', 'Zurgo Bellstriker', 'hand');
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    mana(g, 'C', 1);
    mana(g, 'R', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: again, alternative: true }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: again, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 6 && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 20_000);
    expect(g.state.cards[again]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, card } = armed('Zurgo Bellstriker');
    mana(g, 'C', 1);
    mana(g, 'R', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card, alternative: true }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
