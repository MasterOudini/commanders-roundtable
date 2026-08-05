// `Carnage Altar` — the sacrifice-cost CHOOSER's front door (D168): the
// activation NAMES the creature that pays, the offer exists only while a legal
// candidate does, and every wrong answer is a refusal that eats nothing.

import { describe, expect, test } from 'vitest';
import { faceOf } from '../../oracle';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { legalActions } from '../../legal';
import { checkInvariants } from '../../invariants';
import { CARNAGE_ALTAR_SCRIPT } from './carnageAltar';
import { CARNAGE_ALTAR, SOLDIER_TOKEN } from '../../../data/fixtures/engineCards';
import { ORACLE, advanceUntil, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ALTAR = 'Carnage Altar';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[ALTAR, BEARS], []],
    scripts: createRegistry([CARNAGE_ALTAR_SCRIPT]),
  });
}

function offersFor(g: Game, card: string) {
  return legalActions(g.state, ORACLE, g.deps.scripts, 'p1').filter(
    (a) => a.t === 'ActivateAbility' && a.card === card,
  );
}

describe('Carnage Altar', () => {
  test('the parse says what the machinery assumes: a payable chooser cost, not self-sacrifice', () => {
    const oc = ORACLE.byPrinting(CARNAGE_ALTAR.scryfallId);
    const abilities = faceOf(oc!, 0).activated;
    expect(abilities).toHaveLength(1);
    expect(abilities[0]?.payable).toBe(true);
    expect(abilities[0]?.sacrificesSelf).toBe(false);
    expect(abilities[0]?.sacrificeCost).toEqual({
      another: false,
      any: [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }],
    });
    expect(abilities[0]?.unpaidCosts).toEqual([]);
  });

  test('no creature, no offer — the ability appears the moment a candidate does', () => {
    const g = game();
    const altar = put(g, 'p1', ALTAR);
    settle(g);
    // The Altar is an artifact: it cannot feed its own creature-only cost.
    expect(offersFor(g, altar)).toHaveLength(0);
    const bears = put(g, 'p1', BEARS);
    settle(g);
    const offers = offersFor(g, altar);
    expect(offers).toHaveLength(1);
    const offer = offers[0];
    expect(offer?.t === 'ActivateAbility' ? offer.sacrificeCandidates : null).toEqual([bears]);
  });

  test('sacrifices the NAMED creature at activation, keeps the Altar, draws on resolution', () => {
    const g = game();
    const altar = put(g, 'p1', ALTAR);
    const bears = put(g, 'p1', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    const handBefore = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: altar, abilityIndex: 0, sacrifice: bears }));
    // ⚠️ BEFORE settling: the cost is already paid (CR 602.2b), so the Bears is
    // in the graveyard while the draw is still on the stack — and the ALTAR is
    // untouched, because the chooser cost never eats the source.
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[altar]?.zone.kind).toBe('battlefield');
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(handBefore + 1);
    expect(
      g.log.some((e) => e.body.t === 'Narrated' && /sacrifices Grizzly Bears/.test(e.body.text)),
    ).toBe(true);
  });

  test('the WRONG KIND is refused — an artifact cannot pay a creature-only cost', () => {
    const g = game();
    const altar = put(g, 'p1', ALTAR);
    put(g, 'p1', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: altar, abilityIndex: 0, sacrifice: altar });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
    expect(g.state.cards[altar]?.zone.kind).toBe('battlefield');
  });

  test('a MISSING pick is refused and nothing is eaten', () => {
    const g = game();
    const altar = put(g, 'p1', ALTAR);
    const bears = put(g, 'p1', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    const logAt = g.log.length;
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: altar, abilityIndex: 0 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('needsSacrifice');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.log.length).toBe(logAt);
  });

  /**
   * ⚠️ THE FUZZ GATE'S OWN FINDING (seed 305), pinned. Sacrificing an ATTACKING
   * TOKEN at instant speed deletes the instance (`TokensCeased`) while combat
   * still names it — every other dead combatant still EXISTS in a graveyard,
   * which is all the "filter at use" convention needs, and the ordinary death
   * windows auto-pass through end of combat before anything looks. A chooser
   * cost paid while an awaiting holds the pump mid-combat is what made the
   * stale reference visible. The reducer's `TokensCeased` prunes combat now;
   * without that prune this test fails with `attacker … does not exist`.
   */
  test('sacrificing an ATTACKING TOKEN leaves combat clean (fuzz seed 305)', () => {
    const g = game();
    holdEverywhere(g);
    const altar = put(g, 'p1', ALTAR);
    must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: SOLDIER_TOKEN.scryfallId, count: 1 }));
    const tok = Object.keys(g.state.cards).find((id) => g.state.cards[id]?.isToken);
    expect(tok).toBeDefined();
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: tok as InstanceId, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    // p1 holds priority in the declare-attackers step (holdEverywhere), with
    // the token on the attackers list — the exact window the fuzzer found.
    advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    expect(g.state.combat?.attackers.some((a) => a.card === tok)).toBe(true);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: altar, abilityIndex: 0, sacrifice: tok as InstanceId }));
    settle(g);
    // The token is GONE — not in a graveyard, deleted — and combat must not
    // name it, or the state is one no event can repair.
    expect(g.state.cards[tok as InstanceId]).toBeUndefined();
    expect(g.state.combat?.attackers.some((a) => a.card === tok) ?? false).toBe(false);
    expect(checkInvariants(g.state)).toEqual([]);
  });

  test('replays to the same hash', () => {
    const g = game();
    const altar = put(g, 'p1', ALTAR);
    const bears = put(g, 'p1', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: altar, abilityIndex: 0, sacrifice: bears }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
