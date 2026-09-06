// D343 (gate 197, seed 306) — AN ACTIVATED ABILITY WHOSE ONLY TARGET HAS GONE
// DOES NOT RESOLVE (CR 608.2b). The re-check in `resolveAbility` asked the
// TRIGGER def's clauses and, with none, fell to the no-clause branch — the CR
// restrictions alone — so a ping aimed at a creature that died in response
// resolved anyway; a def that reads its target's zone itself did nothing, a
// generated one marked damage on a card in a graveyard, which the invariants
// name. The clauses of an activated ability live on the parsed face, where the
// offer and the validation already read them. Proven on the gate's own card
// (Mage il-Vec, whose def trusts the re-check) and on Prodigal Pyromancer
// (whose def guards the zone itself, and must still not resolve).
import { describe, expect, test } from 'vitest';
import { checkInvariants } from './invariants';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { MAGE_IL_VEC_SCRIPT } from './scripts/cards/mageIlVec';
import { PRODIGAL_PYROMANCER_SCRIPT } from './scripts/cards/prodigalPyromancer';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const MAGE = 'Mage il-Vec';
const TIM = 'Prodigal Pyromancer';
const BEARS = 'Grizzly Bears';
const BOLT = 'Lightning Bolt';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function toMyMain(g: Game): void {
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.turn.turnNumber >= 3,
    60_000,
  );
  holdEverywhere(g);
}
const pingsFrom = (g: Game, source: string) =>
  g.log.filter((e) => e.body.t === 'DamageDealt' && e.body.damages.some((d) => d.source === source)).length;
const fizzled = (g: Game) => g.state.narration.some((l) => l.text.includes('no legal target left'));

describe('CR 608.2b for an activated ability', () => {
  test('the gate\'s own shape: Mage il-Vec pings itself, a Bolt kills it in response, the ping does not resolve', () => {
    const g = startedGame({ players: 2, decks: [[MAGE, BEARS], [BOLT, BEARS]], scripts: createRegistry([MAGE_IL_VEC_SCRIPT]) });
    const mage = put(g, 'p1', MAGE);
    put(g, 'p1', BEARS, 'hand'); // the random discard's fodder
    const bolt = put(g, 'p2', BOLT, 'hand');
    toMyMain(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mage }] }));
    expect(g.state.stack).toHaveLength(1);
    // The opponent answers with a Bolt at the pinger: the Bolt resolves first.
    advanceUntil(g, (s) => s.priority.player === 'p2' && s.stack.length === 1, 20_000);
    must(g.submit({ t: 'CastSpell', player: 'p2', card: bolt, targets: [{ kind: 'card', id: mage }] }));
    expect(g.state.stack).toHaveLength(2);
    settle(g);
    expect(g.state.cards[mage]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mage]?.damage).toBe(0);
    expect(pingsFrom(g, mage)).toBe(0);
    expect(fizzled(g)).toBe(true);
    expect(checkInvariants(g.state)).toEqual([]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a ping whose target died in response does not resolve, even when its def would have guarded the zone', () => {
    const g = startedGame({ players: 2, decks: [[TIM, BOLT, BEARS], [BEARS]], scripts: createRegistry([PRODIGAL_PYROMANCER_SCRIPT]) });
    const tim = put(g, 'p1', TIM);
    const bears = put(g, 'p2', BEARS);
    const bolt = put(g, 'p1', BOLT, 'hand');
    toMyMain(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tim, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }));
    expect(g.state.stack).toHaveLength(1);
    // The activator keeps priority: the Bolt goes on top and kills the target first.
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: bears }] }));
    expect(g.state.stack).toHaveLength(2);
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.damage).toBe(0);
    expect(pingsFrom(g, tim)).toBe(0);
    expect(fizzled(g)).toBe(true);
    expect(checkInvariants(g.state)).toEqual([]);
  });

  test('a ping whose target is still there resolves as before', () => {
    const g = startedGame({ players: 2, decks: [[TIM, BEARS], [BEARS]], scripts: createRegistry([PRODIGAL_PYROMANCER_SCRIPT]) });
    const tim = put(g, 'p1', TIM);
    const bears = put(g, 'p2', BEARS);
    toMyMain(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tim, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(pingsFrom(g, tim)).toBe(1);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.damage).toBe(1);
    expect(fizzled(g)).toBe(false);
  });
});
