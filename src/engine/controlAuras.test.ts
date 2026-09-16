// D453 - THE CONTROL AURAS (CR 613.2, layer 2 through a static). `You control enchanted creature.` on an Aura: while
// the Aura stays attached, its controller controls the enchanted permanent; when the Aura leaves, moves on or falls
// off, the permanent goes back to whoever had it. One face flag (`controlsEnchanted`), a memory on the enchanted
// permanent (`controlledVia`: the Aura, its entry stamp, the way back) and a state-based built-in in `sba.ts` that
// takes and gives back - every road an Aura takes onto or off a permanent ends in that sweep. Proven on Mind Control
// with no script at all.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SCRIPTS = createRegistry([]);

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
function mana(g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
}

describe('D453 - the face flag', () => {
  test('Mind Control and Control Magic read it; a Pacifism does not', () => {
    expect(ORACLE.byName('Mind Control')?.faces[0]?.controlsEnchanted).toBe(true);
    expect(ORACLE.byName('Control Magic')?.faces[0]?.controlsEnchanted).toBe(true);
    expect(ORACLE.byName('Pacifism')?.faces[0]?.controlsEnchanted).toBe(false);
  });
});

/** p2's Cyclops on the board, Mind Control in p1's hand, p1 in its third-turn main phase. */
function armed(): { g: Game; aura: InstanceId; cyclops: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Mind Control'], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
  holdEverywhere(g);
  const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  const aura = put(g, 'p1', 'Mind Control', 'hand');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, aura, cyclops };
}
function steal(g: Game, aura: InstanceId, cyclops: InstanceId): void {
  mana(g, 'C', 3);
  mana(g, 'U', 2);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: aura, targets: [{ kind: 'card', id: cyclops }] }));
  settle(g);
}

describe('D453 - taken and given back (Mind Control)', () => {
  test('the Aura resolves attached and p1 controls the Cyclops, summoning sick this turn, attacking next turn', () => {
    const { g, aura, cyclops } = armed();
    steal(g, aura, cyclops);
    expect(g.state.cards[aura]?.attachedTo).toBe(cyclops);
    expect(g.state.cards[cyclops]?.controller).toBe('p1');
    expect(g.state.cards[cyclops]?.controlledVia?.source).toBe(aura);
    expect(g.state.cards[cyclops]?.controlledVia?.revertTo).toBe('p2');
    // CR 302.6 - it came under p1's control this turn: no attack this combat.
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'beginCombat' && s.priority.awaiting === null, 20_000);
    const early = g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: cyclops, defender: { kind: 'player', id: 'p2' } }] });
    expect(early.ok).toBe(false);
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: cyclops, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'postcombatMain' && s.priority.awaiting === null, 40_000);
    expect(g.state.players.p2?.life).toBe(35);
  });

  test('the Aura leaving gives the Cyclops back to p2, and the memory is gone', () => {
    const { g, aura, cyclops } = armed();
    steal(g, aura, cyclops);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: aura, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[cyclops]?.controller).toBe('p2');
    expect(g.state.cards[cyclops]?.controlledVia).toBeUndefined();
    expect(g.log.some((e) => e.body.t === 'ControlReverted' && e.body.card === cyclops)).toBe(true);
  });

  test('the Aura on a creature its caster already controls takes nothing', () => {
    const g = startedGame({ players: 2, decks: [['Mind Control', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const aura = put(g, 'p1', 'Mind Control', 'hand');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    steal(g, aura, bears);
    expect(g.state.cards[bears]?.controller).toBe('p1');
    expect(g.state.cards[bears]?.controlledVia).toBeUndefined();
    expect(g.log.some((e) => e.body.t === 'ControlTakenByAura')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, aura, cyclops } = armed();
    steal(g, aura, cyclops);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: aura, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
