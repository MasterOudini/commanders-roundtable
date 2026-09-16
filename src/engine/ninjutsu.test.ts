// D462 - NINJUTSU (CR 702.49a): "Ninjutsu {cost}" is an activated ability from the HAND - the printed mana plus the
// return of an unblocked attacking creature you control - whose effect the engine runs natively: the card enters
// tapped and attacking the player the returned creature was attacking. The parser synthesizes it (D448's unearth
// shape); the return is D352's chooser with one more predicate (an unblocked attacker); `legal.ts` offers it from the
// hand inside the combat window; the stack object remembers the defender. Proven on Mukotai Ambusher (no script):
// offered once blockers are declared and the Bears is unblocked, refused in the main phase and with the Bears
// blocked; the Bears in hand, the Ambusher tapped and attacking, its combat damage (lifelink) dealt; the replay hash.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { legalActions } from './legal';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
function mana(g: Game, symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: number): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
}
function armed(): { g: Game; ninja: InstanceId; bears: InstanceId; cyclops: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Mukotai Ambusher', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([]) });
  holdEverywhere(g);
  const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  const bears = put(g, 'p1', 'Grizzly Bears');
  const ninja = put(g, 'p1', 'Mukotai Ambusher', 'hand');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, ninja, bears, cyclops };
}
function offered(g: Game, ninja: InstanceId) {
  return legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((a) => a.t === 'ActivateAbility' && a.card === ninja);
}
function attackAndBlock(g: Game, bears: InstanceId, blocks: readonly { blocker: InstanceId; attacker: InstanceId }[]): void {
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
  must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks }));
  advanceUntil(g, (s) => s.turn.step === 'declareBlockers' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
}

describe('D462 - the parse', () => {
  test('the ninjutsu line is a hand activation with the mana and an unblocked-attacker return, resolved natively', () => {
    const a = ORACLE.byName('Mukotai Ambusher')?.faces[0]?.activated.find((x) => x.ninjutsu !== undefined);
    expect(a?.ninjutsu).toEqual({ line: 'Ninjutsu {1}{B}' });
    expect(a?.manaCost?.colored.B).toBe(1);
    expect(a?.returnCost?.count).toBe(1);
    expect(a?.returnCost?.any[0]?.unblockedAttacker).toBe(true);
    expect(a?.payable).toBe(true);
    expect(a?.sorceryOnly).toBe(false);
  });
});

describe('D462 - ninjutsu, charged and resolved (Mukotai Ambusher)', () => {
  test('not offered in the main phase; offered once blockers are declared and the Bears is unblocked', () => {
    const { g, ninja, bears } = armed();
    expect(offered(g, ninja)).toBeUndefined();
    mana(g, 'C', 1);
    mana(g, 'B', 1);
    const early = g.submit({ t: 'ActivateAbility', player: 'p1', card: ninja, abilityIndex: 0, returnToHand: [bears] });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.reason).toBe('timingRestriction');
    must(g.submit({ t: 'ManualEmptyPool', player: 'p1', target: 'p1' }));
    attackAndBlock(g, bears, []);
    const offer = offered(g, ninja);
    expect(offer?.t).toBe('ActivateAbility');
    if (offer?.t === 'ActivateAbility') expect(offer.returnCandidates).toEqual([bears]);
  });

  test('the Bears goes home, the Ambusher enters tapped and attacking, and its lifelink damage lands', () => {
    const { g, ninja, bears } = armed();
    attackAndBlock(g, bears, []);
    mana(g, 'C', 1);
    mana(g, 'B', 1);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ninja, abilityIndex: 0, returnToHand: [bears] }));
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(g.state.stack.some((o) => o.ninjutsuDefender?.kind === 'player')).toBe(true);
    settle(g);
    expect(g.state.cards[ninja]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[ninja]?.tapped).toBe(true);
    expect(g.state.combat?.attackers.some((a) => a.card === ninja && a.defender.kind === 'player' && a.defender.id === 'p2' && !a.becameBlocked)).toBe(true);
    expect(g.state.combat?.attackers.some((a) => a.card === bears)).toBe(false);
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' && s.priority.awaiting === null, 20_000);
    expect(g.state.players.p2?.life).toBe(37);
    expect(g.state.players.p1?.life).toBe(43);
  });

  test('a blocked attacker cannot be returned: no offer, the activation refused', () => {
    const { g, ninja, bears, cyclops } = armed();
    attackAndBlock(g, bears, [{ blocker: cyclops, attacker: bears }]);
    expect(offered(g, ninja)).toBeUndefined();
    mana(g, 'C', 1);
    mana(g, 'B', 1);
    const blocked = g.submit({ t: 'ActivateAbility', player: 'p1', card: ninja, abilityIndex: 0, returnToHand: [bears] });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe('illegalReturn');
  });

  test('replays to the same hash', () => {
    const { g, ninja, bears } = armed();
    attackAndBlock(g, bears, []);
    mana(g, 'C', 1);
    mana(g, 'B', 1);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ninja, abilityIndex: 0, returnToHand: [bears] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
