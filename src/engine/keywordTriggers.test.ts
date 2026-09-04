// D308 - THE KEYWORD-TRIGGER SEAM: seven keywords that are triggered abilities
// run from one table with no script per card. Each is proven on a vanilla
// carrier: prowess (Monastery Swiftspear), exalted (Akrasan Squire), bushido
// (Kitsune Blademaster), flanking (Fallen Askari), persist (Safehold Elite),
// undying (Young Wolf), evolve (Cloudfin Raptor) - and each game replays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { derive } from './derive';
import { createRegistry } from './scripts/registry';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function main3(g: Game): void {
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
}

function game(p1: string[], p2: string[] = ['Cyclops of One-Eyed Pass']): Game {
  const g = startedGame({ players: 2, decks: [p1, p2], scripts: createRegistry([]) });
  holdEverywhere(g);
  return g;
}

describe('the keyword triggers (D308)', () => {
  test('prowess: a noncreature spell cast pumps it until end of turn', () => {
    const g = game(['Monastery Swiftspear', 'Feeling of Dread']);
    const swift = put(g, 'p1', 'Monastery Swiftspear');
    put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    const dread = put(g, 'p1', 'Feeling of Dread', 'hand');
    main3(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: dread, targets: [] }));
    settle(g);
    expect(pt(g, swift)).toEqual([2, 3]);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(pt(g, swift)).toEqual([1, 2]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('exalted: a creature attacking alone gets +1/+1 until end of turn; two attackers get nothing', () => {
    const g = game(['Akrasan Squire', 'Grizzly Bears']);
    const squire = put(g, 'p1', 'Akrasan Squire');
    const bears = put(g, 'p1', 'Grizzly Bears');
    put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    expect(pt(g, bears)).toEqual([3, 3]);
    expect(pt(g, squire)).toEqual([1, 1]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

    const h = game(['Akrasan Squire', 'Grizzly Bears']);
    const squire2 = put(h, 'p1', 'Akrasan Squire');
    const bears2 = put(h, 'p1', 'Grizzly Bears');
    put(h, 'p2', 'Cyclops of One-Eyed Pass');
    settle(h);
    advanceUntil(h, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(h.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears2, defender: { kind: 'player', id: 'p2' } }, { card: squire2, defender: { kind: 'player', id: 'p2' } }] }));
    settle(h);
    expect(pt(h, bears2)).toEqual([2, 2]);
    expect(pt(h, squire2)).toEqual([1, 1]);
  });

  test('bushido 1: blocked, it gets +1/+1 until end of turn', () => {
    const g = game(['Kitsune Blademaster']);
    const blademaster = put(g, 'p1', 'Kitsune Blademaster');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: blademaster, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: cyclops, attacker: blademaster }] }));
    settle(g);
    expect(pt(g, blademaster)).toEqual([3, 3]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('flanking: a blocker without flanking gets -1/-1 until end of turn', () => {
    const g = game(['Fallen Askari']);
    const askari = put(g, 'p1', 'Fallen Askari');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: askari, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: cyclops, attacker: askari }] }));
    settle(g);
    expect(pt(g, cyclops)).toEqual([4, 1]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('persist: dying without a -1/-1 counter it returns with one; dying again it stays dead', () => {
    const g = game(['Safehold Elite']);
    const elite = put(g, 'p1', 'Safehold Elite');
    put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    main3(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: elite, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[elite]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[elite]?.counters['-1/-1'] ?? 0).toBe(1);
    expect(pt(g, elite)).toEqual([1, 1]);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: elite, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[elite]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('undying: dying without a +1/+1 counter it returns with one', () => {
    const g = game(['Young Wolf']);
    const wolf = put(g, 'p1', 'Young Wolf');
    put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    main3(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: wolf, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[wolf]?.zone.kind).toBe('battlefield');
    expect(pt(g, wolf)).toEqual([2, 2]);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: wolf, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[wolf]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('evolve: a bigger creature entering under your control puts a +1/+1 counter on it; a smaller one does not', () => {
    const g = game(['Cloudfin Raptor', 'Grizzly Bears', 'Akrasan Squire']);
    const raptor = put(g, 'p1', 'Cloudfin Raptor');
    put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    main3(g);
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    expect(pt(g, raptor)).toEqual([1, 2]);
    put(g, 'p1', 'Akrasan Squire');
    settle(g);
    expect(pt(g, raptor)).toEqual([1, 2]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
