// D552 - DETAIN (CR 701.35a): "Until your next turn, that permanent can't attack or block and its activated abilities
// can't be activated." A vocabulary effect (`Detain <target>.`, counted targets one step per pick), a mark on the card
// (`detainedBy`) cleared as the detaining player's next turn begins and as the permanent leaves, and ONE predicate
// (`isDetained`) asked by the attack and block checks, the activation offer and host, and the mana sources. What is
// proven here: the reading and the spells complete; Inaction Injunction detains the Bears - the attack prompt leaves it
// out and a declaration naming it is refused, the block validator refuses it, the mark gone as p1's next turn begins; a
// detained Llanowar Elves makes no mana (no tap offered, the host refuses) and a detained Guildmage activates nothing;
// Lyev Decree detains two; a detained creature that leaves and returns is a new object; a detainer who has lost detains
// nothing; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import { isDetained } from './detain';
import { manaSourcesOf } from './mana';
import type { Game } from './game';
import type { PlayerId } from './types/ids';

const LANDS = ['Plains', 'Plains', 'Plains', 'Plains', 'Island', 'Island', 'Island', 'Island'];
const main = (g: Game, turn: number, who: PlayerId = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const mana = (g: Game, who: PlayerId, sym: 'W' | 'U' | 'G' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: sym, amount: n }));
const at = (id: PlayerId) => ({ kind: 'player', id }) as const;

describe('D552 - detain', () => {
  test('the reading: a detain clause per target, the spells complete', () => {
    expect(faceNamed('Inaction Injunction').effects.map((e) => e.kind)).toEqual(['detain', 'draw']);
    expect(faceNamed('Lyev Decree').effects.map((e) => e.kind)).toEqual(['detain']);
    for (const name of ['Inaction Injunction', 'Lyev Decree']) expect(isEngineComplete(fixture(name)), name).toBe(true);
  });

  test("Inaction Injunction: the Bears can't attack or block until p1's next turn begins", () => {
    const g = startedGame({ players: 2, decks: [['Inaction Injunction', 'Grizzly Bears', ...LANDS], ['Grizzly Bears', 'Llanowar Elves', ...LANDS]] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Inaction Injunction', 'hand');
    const mine = put(g, 'p1', 'Grizzly Bears');
    const theirs = put(g, 'p2', 'Grizzly Bears');
    // An undetained blocker keeps the declare-blockers prompt (with the Bears alone detained, there is no block to ask).
    put(g, 'p2', 'Llanowar Elves');
    main(g, 3);
    mana(g, 'p1', 'U', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.detainedBy).toBe('p1');
    expect(isDetained(g.state, theirs)).toBe(true);
    // p1 attacks; the detained Bears may not block.
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers' && s.priority.awaiting.player === 'p1', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: mine, defender: at('p2') }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    const block = g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: theirs, attacker: mine }] });
    expect(block.ok, 'a detained creature cannot block').toBe(false);
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [] }));
    // p2's turn: the prompt leaves the Bears out, and naming it is refused.
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    const awaiting = g.state.priority.awaiting;
    if (awaiting?.kind === 'declareAttackers') expect(awaiting.attackers).not.toContain(theirs);
    expect(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: theirs, defender: at('p1') }] }).ok, 'a detained creature cannot attack').toBe(false);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [] }));
    // p1's next turn: the detain is over.
    advanceUntil(g, (s) => s.turn.turnNumber === 5, 40_000);
    expect(g.state.cards[theirs]?.detainedBy).toBeUndefined();
    expect(isDetained(g.state, theirs)).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a detained Llanowar Elves makes no mana, and a detained Guildmage activates nothing', () => {
    const g = startedGame({ players: 2, decks: [['Lyev Decree', ...LANDS], ['Llanowar Elves', 'New Prahv Guildmage', ...LANDS]] });
    holdEverywhere(g);
    const decree = put(g, 'p1', 'Lyev Decree', 'hand');
    const elves = put(g, 'p2', 'Llanowar Elves');
    const mage = put(g, 'p2', 'New Prahv Guildmage');
    main(g, 3);
    mana(g, 'p1', 'W', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: decree, targets: [{ kind: 'card', id: elves }, { kind: 'card', id: mage }] }));
    settle(g);
    expect([g.state.cards[elves]?.detainedBy, g.state.cards[mage]?.detainedBy]).toEqual(['p1', 'p1']);
    main(g, 4, 'p2');
    expect(manaSourcesOf(g.state, deps().oracle, g.deps.scripts, 'p2').some((s) => s.card === elves), 'no mana source').toBe(false);
    expect(g.submit({ t: 'TapForMana', player: 'p2', card: elves, abilityIndex: 0, outputChoice: 0 }).ok, 'the host refuses the tap').toBe(false);
    mana(g, 'p2', 'W', 1);
    mana(g, 'p2', 'U', 1);
    const offered = legalActions(g.state, deps().oracle, g.deps.scripts, 'p2');
    expect(offered.some((a) => a.t === 'ActivateAbility' && a.card === mage), 'no activation offered').toBe(false);
    expect(g.submit({ t: 'ActivateAbility', player: 'p2', card: mage, abilityIndex: 0, targets: [{ kind: 'card', id: mage }] }).ok, 'the host refuses it').toBe(false);
    main(g, 5);
    expect(isDetained(g.state, elves)).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a detained creature that leaves and returns is a new object; a detainer who has lost detains nothing', () => {
    const g = startedGame({ players: 3, decks: [['Inaction Injunction', 'Lyev Decree', ...LANDS], ['Grizzly Bears', 'Llanowar Elves', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Inaction Injunction', 'hand');
    const decree = put(g, 'p1', 'Lyev Decree', 'hand');
    const bears = put(g, 'p2', 'Grizzly Bears');
    const elves = put(g, 'p2', 'Llanowar Elves');
    main(g, 4);
    mana(g, 'p1', 'U', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(isDetained(g.state, bears)).toBe(true);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'hand', player: 'p2' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'battlefield', player: 'p2' } }));
    expect(g.state.cards[bears]?.detainedBy, 'a new object').toBeUndefined();
    // The Elves detained, then p1 loses: the mark waits on a turn that will never come, so it ends with p1.
    mana(g, 'p1', 'W', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: decree, targets: [{ kind: 'card', id: elves }] }));
    settle(g);
    expect(isDetained(g.state, elves)).toBe(true);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: -40 }));
    settle(g);
    expect(g.state.players['p1']?.hasLost).toBe(true);
    expect(isDetained(g.state, elves), 'no next turn to wait for').toBe(false);
    expect(manaSourcesOf(g.state, deps().oracle, g.deps.scripts, 'p2').some((s) => s.card === elves), 'a mana source again').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
