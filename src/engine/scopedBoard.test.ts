// D383 - THE SCOPED BOARD EFFECT. `massPump` (D301) has walked a board-defined SET
// rather than a target since it shipped; these are the same idea with the other
// verbs, over ONE closed scope reader. Every card here resolves through the
// VOCABULARY with no script at all, which is the point: the seam is what makes
// them complete.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';
import { derive } from './derive';
import { deps } from './testing/harness';

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps();
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

const P1 = [
  'Grizzly Bears', 'Aven Skirmisher', 'Darksteel Myr', 'Sol Ring', 'Fog',
  'Fuel the Flames', 'Rolling Temblor', 'Claws of Wirewood', 'Hush', 'Rebuild',
  'Suffocating Fumes', 'Pursue Glory', 'Folk Medicine', 'Grasp of Phantoms',
];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mana(g: Game, symbols: readonly string[]): void {
  for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W', amount: 1 }));
}

/** p1's third-turn main phase, every hold on. */
function armed(): Game {
  const g = startedGame({ players: 2, decks: [P1, ['Cyclops of One-Eyed Pass', 'Grizzly Bears']] });
  holdEverywhere(g);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return g;
}

function cast(g: Game, name: string, symbols: readonly string[], targets: readonly { kind: 'card' | 'player'; id: string }[] = []): void {
  const card = put(g, 'p1', name, 'hand');
  mana(g, symbols);
  must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: targets as never }));
  settle(g);
}

describe('D383 - one scope reader, several verbs', () => {
  test('damage to EACH creature reaches both sides', () => {
    const g = armed();
    const mine = put(g, 'p1', 'Grizzly Bears');
    const theirs = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    cast(g, 'Fuel the Flames', ['R', 'C', 'C']);
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('the keyword filter: WITHOUT flying spares the flyer', () => {
    const g = armed();
    const ground = put(g, 'p1', 'Grizzly Bears');
    const flyer = put(g, 'p1', 'Aven Skirmisher');
    settle(g);
    cast(g, 'Rolling Temblor', ['R', 'C', 'C']);
    expect(g.state.cards[ground]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[flyer]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[flyer]?.damage).toBe(0);
  });

  test('WITH flying, and a second scope: each player takes it too', () => {
    const g = armed();
    const ground = put(g, 'p1', 'Grizzly Bears');
    const flyer = put(g, 'p1', 'Aven Skirmisher');
    settle(g);
    const life1 = g.state.players.p1?.life ?? 0;
    const life2 = g.state.players.p2?.life ?? 0;
    cast(g, 'Claws of Wirewood', ['G', 'C', 'C', 'C']);
    expect(g.state.cards[flyer]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ground]?.zone.kind).toBe('battlefield');
    expect(g.state.players.p1?.life).toBe(life1 - 3);
    expect(g.state.players.p2?.life).toBe(life2 - 3);
  });

  test('destroy all <type>, and indestructible survives it', () => {
    const g = armed();
    const myr = put(g, 'p1', 'Darksteel Myr');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    cast(g, 'Fuel the Flames', ['R', 'C', 'C']);
    // The Myr is indestructible but damage still marks it; only a DESTROY is replaced.
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('return all artifacts goes to their OWNERS hands', () => {
    const g = armed();
    const mine = put(g, 'p1', 'Sol Ring');
    settle(g);
    cast(g, 'Rebuild', ['U', 'C', 'C']);
    expect(g.state.cards[mine]?.zone.kind).toBe('hand');
    expect(g.state.cards[mine]?.zone.player).toBe('p1');
  });

  test('a scoped mass pump: the OPPONENTS creatures, and not mine', () => {
    const g = armed();
    const mine = put(g, 'p1', 'Grizzly Bears');
    const theirs = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    cast(g, 'Suffocating Fumes', ['B', 'C', 'C']);
    // A 2/2 at -1/-1 is a LIVING 1/1 (D227): the scope is read off the P/T, not off a death.
    expect(pt(g, theirs)).toEqual([1, 1]);
    expect(pt(g, mine)).toEqual([2, 2]);
  });

  test('you gain N life for each creature you control', () => {
    const g = armed();
    put(g, 'p1', 'Grizzly Bears');
    put(g, 'p1', 'Aven Skirmisher');
    put(g, 'p2', 'Grizzly Bears');
    settle(g);
    const life0 = g.state.players.p1?.life ?? 0;
    cast(g, 'Folk Medicine', ['G', 'C', 'C']);
    expect(g.state.players.p1?.life).toBe(life0 + 2);
  });

  test('put target creature on top of its owner library, and the game replays', () => {
    const g = armed();
    const theirs = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    const lib0 = (g.state.zones.library.p2 ?? []).length;
    cast(g, 'Grasp of Phantoms', ['U', 'C', 'C', 'C'], [{ kind: 'card', id: theirs }]);
    expect(g.state.cards[theirs]?.zone.kind).toBe('library');
    expect(g.state.zones.library.p2?.[(g.state.zones.library.p2 ?? []).length - 1]).toBe(theirs);
    expect((g.state.zones.library.p2 ?? []).length).toBe(lib0 + 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
