// D361 - THE KEYWORD-TRIGGER TABLE, PART 2: seven more keywords that ARE
// triggered abilities run from the same table with no script per card. Each is
// proven on one of the 31 cards it lands, and each is proven in BOTH directions
// where the rule has two — a soulshift that may not take a Spirit too big for
// its number, a dethrone that pays nothing when the defender is not the leader,
// a training that pays nothing attacking alone.
//
// ⚠️ `soulshift` is the first keyword trigger that is OPTIONAL and that TARGETS,
// so its aim is answered first (CR 603.3d, as the ability goes on the stack) and
// its "you may" second (CR 603.1, on resolution) — the order the two prompts
// come in is itself an assertion here.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { derive } from './derive';
import { createRegistry } from './scripts/registryCore';
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

function game(p1: string[], p2: string[] = ['Cyclops of One-Eyed Pass'], seats = 2): Game {
  const decks = seats === 3 ? [p1, p2, ['Cyclops of One-Eyed Pass']] : [p1, p2];
  const g = startedGame({ players: seats, decks, scripts: createRegistry([]) });
  holdEverywhere(g);
  return g;
}

/**
 * Walk to p1's own next declaration.
 *
 * ⚠️ THE ACTIVE PLAYER, not a turn NUMBER: p1's second turn is turn 3 at two
 * seats and turn 4 at three, and waiting on the number ran a three-seat game to
 * its end and answered `gameOver`.
 */
function toAttack(g: Game): void {
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.turnNumber > 1 && s.priority.awaiting?.kind === 'declareAttackers',
    40_000,
  );
}

/** The other side of combat damage — which `settle` does not reach (D259). */
function toPostcombat(g: Game): void {
  advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' && s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('the keyword triggers, part 2 (D361)', () => {
  test('soulshift: the dying Spirit returns a smaller one, and refuses a bigger one and a non-Spirit', () => {
    // Kami of Empty Graves is a 4/1 Spirit at mana value 4 with Soulshift 3, so
    // its OWN corpse is a Spirit the number does not reach — the refusal the
    // card itself supplies.
    const g = game(['Kami of Empty Graves', 'Cloud Spirit', 'Grizzly Bears']);
    const kami = put(g, 'p1', 'Kami of Empty Graves');
    const spirit = put(g, 'p1', 'Cloud Spirit', 'graveyard');
    const bears = put(g, 'p1', 'Grizzly Bears', 'graveyard');
    settle(g);

    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: kami, to: { kind: 'graveyard', player: 'p1' } }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');

    // A Bear is not a Spirit; the Kami itself is a Spirit at mana value 4.
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: kami }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: spirit }] }));

    // ⚠️ THE AIM FIRST, THE "YOU MAY" SECOND: the target is chosen as the ability
    // goes on the stack (CR 603.3d) and the choice is made when it RESOLVES
    // (CR 603.1), so the second prompt is a whole priority round later.
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('optionalTrigger');
    if (awaiting?.kind !== 'optionalTrigger') throw new Error('no optional prompt');
    must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: awaiting.stackId, accept: true }));
    settle(g);

    expect(g.state.cards[spirit]?.zone.kind).toBe('hand');
    expect(g.state.cards[spirit]?.zone.player).toBe('p1');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('soulshift: declining leaves the card in the graveyard', () => {
    const g = game(['Kami of Empty Graves', 'Cloud Spirit']);
    const kami = put(g, 'p1', 'Kami of Empty Graves');
    const spirit = put(g, 'p1', 'Cloud Spirit', 'graveyard');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: kami, to: { kind: 'graveyard', player: 'p1' } }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: spirit }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
    const awaiting = g.state.priority.awaiting;
    if (awaiting?.kind !== 'optionalTrigger') throw new Error('no optional prompt');
    must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: awaiting.stackId, accept: false }));
    settle(g);
    expect(g.state.cards[spirit]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('soulshift: with no legal Spirit in the graveyard nothing is asked at all (CR 603.3d)', () => {
    const g = game(['Kami of Empty Graves', 'Grizzly Bears']);
    const kami = put(g, 'p1', 'Kami of Empty Graves');
    put(g, 'p1', 'Grizzly Bears', 'graveyard');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: kami, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.cards[kami]?.zone.kind).toBe('graveyard');
  });

  test('afterlife: dying makes N flying Spirits, with DISTINCT ids', () => {
    // Ministrant of Obligation prints Afterlife 2, so its resolve allocates two
    // ids — D164's allocator, the trap a count-only assertion cannot see.
    const g = game(['Ministrant of Obligation']);
    const cleric = put(g, 'p1', 'Ministrant of Obligation');
    settle(g);
    const before = Object.keys(g.state.cards).length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cleric, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);

    const tokens = Object.entries(g.state.cards).filter(([, c]) => c.isToken && c.controller === 'p1');
    expect(tokens.length).toBe(2);
    expect(new Set(tokens.map(([id]) => id)).size).toBe(2);
    expect(Object.keys(g.state.cards).length).toBe(before + 2);
    for (const [id] of tokens) {
      const d = deps(createRegistry([]));
      const got = derive(g.state, d.oracle, d.scripts, id as InstanceId);
      // A token whose printing the oracle cannot name derives to a nameless 0/0.
      expect([got.power, got.toughness]).toEqual([1, 1]);
      expect(got.keywords.has('flying')).toBe(true);
    }
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('dethrone: attacking the player with the most life pays a counter; attacking a poorer one pays nothing', () => {
    const g = game(["Marchesa's Emissary"]);
    const rogue = put(g, 'p1', "Marchesa's Emissary");
    put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    toAttack(g);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: rogue, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    // Both players start at 40, so p2 is tied for most life.
    expect(g.state.cards[rogue]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

    const h = game(["Marchesa's Emissary"]);
    const rogue2 = put(h, 'p1', "Marchesa's Emissary");
    put(h, 'p2', 'Cyclops of One-Eyed Pass');
    settle(h);
    must(h.submit({ t: 'ManualSetLife', player: 'p2', target: 'p2', delta: -5 }));
    toAttack(h);
    must(h.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: rogue2, defender: { kind: 'player', id: 'p2' } }] }));
    settle(h);
    expect(h.state.cards[rogue2]?.counters['+1/+1'] ?? 0).toBe(0);
  });

  test('melee: the pump counts the OPPONENTS attacked, not the attackers', () => {
    // Two attackers at ONE opponent is +1/+1; the same two split across two
    // opponents is +2/+2. Only a three-seat table tells the two apart.
    const g = game(['Wings of the Guard', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass'], 3);
    const wings = put(g, 'p1', 'Wings of the Guard');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    toAttack(g);
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [
          { card: wings, defender: { kind: 'player', id: 'p2' } },
          { card: bears, defender: { kind: 'player', id: 'p2' } },
        ],
      }),
    );
    settle(g);
    expect(pt(g, wings)).toEqual([2, 2]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

    const h = game(['Wings of the Guard', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass'], 3);
    const wings2 = put(h, 'p1', 'Wings of the Guard');
    const bears2 = put(h, 'p1', 'Grizzly Bears');
    settle(h);
    toAttack(h);
    must(
      h.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [
          { card: wings2, defender: { kind: 'player', id: 'p2' } },
          { card: bears2, defender: { kind: 'player', id: 'p3' } },
        ],
      }),
    );
    settle(h);
    expect(pt(h, wings2)).toEqual([3, 3]);
  });

  test('training: a bigger fellow attacker pays a counter; attacking alone pays nothing', () => {
    // Apprentice Sharpshooter is 1/4, Grizzly Bears 2/2: the Bear has greater
    // POWER, which is the only comparison the keyword makes.
    const g = game(['Apprentice Sharpshooter', 'Grizzly Bears']);
    const archer = put(g, 'p1', 'Apprentice Sharpshooter');
    const bears = put(g, 'p1', 'Grizzly Bears');
    put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    toAttack(g);
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [
          { card: archer, defender: { kind: 'player', id: 'p2' } },
          { card: bears, defender: { kind: 'player', id: 'p2' } },
        ],
      }),
    );
    settle(g);
    expect(g.state.cards[archer]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

    const h = game(['Apprentice Sharpshooter', 'Grizzly Bears']);
    const archer2 = put(h, 'p1', 'Apprentice Sharpshooter');
    put(h, 'p1', 'Grizzly Bears');
    put(h, 'p2', 'Cyclops of One-Eyed Pass');
    settle(h);
    toAttack(h);
    must(h.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: archer2, defender: { kind: 'player', id: 'p2' } }] }));
    settle(h);
    expect(h.state.cards[archer2]?.counters['+1/+1'] ?? 0).toBe(0);
  });

  test('afflict: becoming blocked costs the defending player N life; going unblocked costs nothing', () => {
    const g = game(['Spellweaver Eternal']);
    const zombie = put(g, 'p1', 'Spellweaver Eternal');
    const blocker = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    toAttack(g);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: zombie, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker, attacker: zombie }] }));
    advanceUntil(g, (s) => (s.players.p2?.life ?? 40) !== 40 || s.turn.turnNumber > 3, 20_000);
    expect(g.state.players.p2?.life).toBe(38);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

    const h = game(['Spellweaver Eternal']);
    const zombie2 = put(h, 'p1', 'Spellweaver Eternal');
    settle(h);
    toAttack(h);
    must(h.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: zombie2, defender: { kind: 'player', id: 'p2' } }] }));
    // ⚠️ A defender with NO creatures is never asked to block (D234) and `settle`
    // returns before combat damage (D259): the walk has to reach the other side
    // of combat by itself.
    toPostcombat(h);
    // Two combat damage and not a point more: nothing became blocked.
    expect(h.state.players.p2?.life).toBe(38);
  });

  test('ingest: combat damage to a player exiles their top card', () => {
    const g = game(['Culling Drone']);
    const drone = put(g, 'p1', 'Culling Drone');
    settle(g);
    toAttack(g);
    // ⚠️ READ AT THE DECLARATION: p2 takes its own draw step between here and
    // the game's start, so a top snapshotted earlier is a card already drawn.
    const lib = g.state.zones.library.p2 ?? [];
    const top = lib[lib.length - 1];
    expect(top).toBeDefined();
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: drone, defender: { kind: 'player', id: 'p2' } }] }));
    toPostcombat(g);
    expect(g.state.zones.exile.p2).toEqual([top]);
    expect((g.state.zones.library.p2 ?? []).length).toBe(lib.length - 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
