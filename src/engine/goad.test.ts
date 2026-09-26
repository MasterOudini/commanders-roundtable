// D554 - GOAD (CR 701.15a/b): "Until your next turn, that creature attacks each combat if able and attacks a player
// other than you if able." A vocabulary effect (`goad <target>.`, and the mass form over a closed scope), a per-goader
// mark (`goadedBy`, each goader pruned as that player's next turn begins, cleared as the creature leaves), and
// `goadersOf` asked by the requirement, the host's defender rule and the prompt. What is proven here: Disrupt Decorum
// (`Goad all creatures you don't control.`) reads and completes; the goaded Bears must attack on p2's turn (an empty
// declaration refused; with one opponent it attacks its goader), the goad gone as p1's next turn begins; with two
// opponents it may not attack its goader (the prompt names whom it avoids, the host refuses the goader and accepts the
// other), and a goader who has lost goads nothing; two goaders pruned one at a time; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import { goadersOf } from './goad';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId, PlayerId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number, who: PlayerId) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const at = (id: PlayerId) => ({ kind: 'player', id }) as const;
/** `who` casts Disrupt Decorum ({2}{R}{R}, the mana added by hand) in its main phase. */
function decorum(g: Game, who: PlayerId, card: InstanceId): void {
  must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: who, card }));
  settle(g);
}
const attackPrompt = (g: Game, turn: number) => {
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
  const awaiting = g.state.priority.awaiting;
  if (awaiting?.kind !== 'declareAttackers') throw new Error('no attack prompt');
  return awaiting;
};

describe('D554 - goad', () => {
  test('the reading: the mass form over a closed scope; Disrupt Decorum complete', () => {
    const c = deps().oracle.byName('Disrupt Decorum');
    if (!c) throw new Error('no fixture');
    const effects = faceOf(c, 0).effects;
    expect(effects.map((e) => e.kind)).toEqual(['goad']);
    expect(effects[0]?.targetIndex).toBe(-1);
    expect(isEngineComplete(fixture('Disrupt Decorum'))).toBe(true);
  });

  test('the goaded Bears attack on p2' + "'" + 's turn - an empty declaration refused - and the goad ends at p1' + "'" + 's next turn', () => {
    const g = startedGame({ players: 2, decks: [['Disrupt Decorum'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Disrupt Decorum', 'hand');
    const bears = put(g, 'p2', 'Grizzly Bears');
    main(g, 3, 'p1');
    decorum(g, 'p1', spell);
    expect(g.state.cards[bears]?.goadedBy).toEqual(['p1']);
    const awaiting = attackPrompt(g, 4);
    expect(awaiting.required).toContain(bears);
    expect(awaiting.goaded).toEqual([{ card: bears, avoid: ['p1'] }]);
    expect(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [] }).ok, 'it attacks each combat if able').toBe(false);
    // With one opponent the goader is the only player it can attack: it attacks p1.
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: bears, defender: at('p1') }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === 5, 40_000);
    expect(g.state.cards[bears]?.goadedBy, 'the goad ends as p1' + "'" + 's next turn begins').toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('with two opponents it may not attack its goader; a goader who has lost goads nothing', () => {
    const g = startedGame({ players: 3, decks: [['Disrupt Decorum'], ['Grizzly Bears'], ['Island']] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Disrupt Decorum', 'hand');
    const bears = put(g, 'p2', 'Grizzly Bears');
    main(g, 4, 'p1');
    decorum(g, 'p1', spell);
    const awaiting = attackPrompt(g, 5);
    expect(awaiting.goaded).toEqual([{ card: bears, avoid: ['p1'] }]);
    expect(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: bears, defender: at('p1') }] }).ok, 'not its goader while p3 can be attacked').toBe(false);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: bears, defender: at('p3') }] }));
    settle(g);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: -40 }));
    settle(g);
    expect(g.state.players['p1']?.hasLost).toBe(true);
    expect(goadersOf(g.state, bears), 'no next turn to wait for').toEqual([]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('goaded by both opponents it attacks either; each goader is pruned at its own turn', () => {
    const g = startedGame({ players: 3, decks: [['Disrupt Decorum'], ['Grizzly Bears'], ['Disrupt Decorum']] });
    holdEverywhere(g);
    const d1 = put(g, 'p1', 'Disrupt Decorum', 'hand');
    const d3 = put(g, 'p3', 'Disrupt Decorum', 'hand');
    const bears = put(g, 'p2', 'Grizzly Bears');
    main(g, 3, 'p3');
    decorum(g, 'p3', d3);
    main(g, 4, 'p1');
    decorum(g, 'p1', d1);
    expect(g.state.cards[bears]?.goadedBy).toEqual(['p3', 'p1']);
    const awaiting = attackPrompt(g, 5);
    expect(awaiting.goaded).toEqual([{ card: bears, avoid: ['p3', 'p1'] }]);
    // Every player it can attack goaded it: it attacks one of them.
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: bears, defender: at('p3') }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === 6, 40_000);
    expect(g.state.cards[bears]?.goadedBy, 'p3' + "'" + 's goad ends at p3' + "'" + 's turn; p1' + "'" + 's stays').toEqual(['p1']);
    advanceUntil(g, (s) => s.turn.turnNumber === 7, 40_000);
    expect(g.state.cards[bears]?.goadedBy).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
