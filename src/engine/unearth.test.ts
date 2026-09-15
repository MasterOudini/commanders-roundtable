// D448 - UNEARTH (CR 702.84). "Unearth {cost}" is an activated ability that functions from the graveyard:
// "[Cost]: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of
// the next end step or if it would leave the battlefield. Activate only as a sorcery." The parser SYNTHESIZES the
// ability off the printed line (D440's scavenge one keyword over), `legal.ts` offers it from the owner's graveyard
// at sorcery speed with no def to require, and `resolveAbility` runs it natively: the return, the `unearthed`
// flag (haste in `derive`), a delayed trigger armed for the next end step (D402) whose one effect is the new
// `exileSelf`, and the replacement funnel's `withUnearthedLeavingToExile` for a leave by any other road.
// Proven on Dregscape Zombie ({1}{B} 2/1, Unearth {B}) - a card with no script at all.

import { describe, expect, test } from 'vitest';
import { parseActivatedAbilities } from '../data/activatedParse';
import { parseManaCost } from '../data/oracleParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const parse = (text: string) =>
  parseActivatedAbilities({ oracleText: text, isPermanent: true, producesMana: [], parseCost: (raw) => parseManaCost(raw) });

describe('D448 - unearth, parsed', () => {
  test('"Unearth {B}" is a synthesized ability from the graveyard at sorcery speed', () => {
    const [a] = parse('Unearth {B}');
    expect(a?.unearth).toEqual({ line: 'Unearth {B}' });
    expect(a?.activatesFromGraveyard).toBe(true);
    expect(a?.sorceryOnly).toBe(true);
    expect(a?.payable).toBe(true);
    expect(a?.targets).toEqual([]);
  });

  test('a two-symbol price reads, the reminder text aside', () => {
    const [a] = parse('Unearth {1}{R} (Unearth {1}{R}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step or if it would leave the battlefield. Unearth only as a sorcery.)');
    expect(a?.unearth).toEqual({ line: 'Unearth {1}{R}' });
    expect(a?.manaCost?.generic).toBe(1);
  });
});

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}

const SCRIPTS = createRegistry([]);

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(SCRIPTS);
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

/** Dregscape Zombie in p1's graveyard, p1 in its third-turn main phase holding priority. */
function armed(): { g: Game; zombie: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Dregscape Zombie'], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
  holdEverywhere(g);
  const zombie = put(g, 'p1', 'Dregscape Zombie', 'graveyard');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, zombie };
}

function unearth(g: Game, zombie: InstanceId): ReturnType<Game['submit']> {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  const face = deps(SCRIPTS).oracle.byPrinting(g.state.cards[zombie]?.printingId ?? '')?.faces[0];
  const index = face?.activated.findIndex((a) => a.unearth !== undefined) ?? -1;
  return g.submit({ t: 'ActivateAbility', player: 'p1', card: zombie, abilityIndex: index });
}

describe('D448 - unearth, charged and resolved (Dregscape Zombie)', () => {
  test('it returns from the graveyard with haste, attacks the turn it came back, and is exiled at the end step', () => {
    const { g, zombie } = armed();
    expect(g.state.cards[zombie]?.zone.kind).toBe('graveyard');
    must(unearth(g, zombie));
    settle(g);
    expect(g.state.cards[zombie]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[zombie]?.controller).toBe('p1');
    expect(g.state.cards[zombie]?.unearthed).toBe(true);
    expect(kw(g, zombie).has('haste')).toBe(true);
    expect(g.state.delayedTriggers.some((d) => d.source === zombie && d.when.step === 'end')).toBe(true);
    // Haste: it attacks the same turn (CR 702.10b would otherwise keep a fresh creature home).
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: zombie, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' && s.priority.awaiting === null, 20_000);
    expect(g.state.players.p2?.life).toBe(38);
    // The next end step exiles it, and the entry leaves the delayed list.
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 20_000);
    expect(g.state.cards[zombie]?.zone.kind).toBe('exile');
    expect(g.state.delayedTriggers.some((d) => d.source === zombie)).toBe(false);
  });

  test('a leave by any other road is exile instead: a bounce sends it to exile, not to hand', () => {
    const { g, zombie } = armed();
    must(unearth(g, zombie));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: zombie, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[zombie]?.zone.kind).toBe('exile');
    expect(g.state.cards[zombie]?.unearthed).toBeUndefined();
    // The end step then finds nothing to exile and the game goes on.
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 20_000);
    expect(g.state.cards[zombie]?.zone.kind).toBe('exile');
  });

  test('sorcery speed: refused in combat; refused again once it is on the battlefield', () => {
    const { g, zombie } = armed();
    advanceUntil(g, (s) => s.turn.step === 'beginCombat' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const early = unearth(g, zombie);
    expect(early.ok).toBe(false);
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualEmptyPool', player: 'p1', target: 'p1' }));
    must(unearth(g, zombie));
    settle(g);
    expect(g.state.cards[zombie]?.zone.kind).toBe('battlefield');
    must(g.submit({ t: 'ManualEmptyPool', player: 'p1', target: 'p1' }));
    const again = unearth(g, zombie);
    expect(again.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, zombie } = armed();
    must(unearth(g, zombie));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
