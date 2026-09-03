import { describe, expect, test } from 'vitest';
import { legalActions } from './legal';
import { candidatesFromState, legalTargetsFor, targetAllowed } from './targets';
import { faceOf } from './oracle';
import { parseSpellTargets, parseTargetClauses } from '../data/targetParse';
import { ORACLE, deps, findAnywhere, fullControl, must, nameOf, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { TargetChoice } from './types/state';

// Targeting, end to end: what a card says it targets, what the engine will
// accept, and what it charges for it.
//
// ⚠️ Every board is built through real intents by the harness, so a scenario
// here is one the engine could genuinely reach.

function boltBoard(extra: string[] = []): { game: Game; bolt: string } {
  const game = startedGame({ decks: [['Mountain', 'Lightning Bolt', ...extra]] });
  fullControl(game, 'p1');
  put(game, 'p1', 'Mountain');
  const bolt = findAnywhere(game, 'p1', 'Lightning Bolt');
  must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'hand', player: 'p1' } }));
  return { game, bolt };
}

function specsOf(name: string) {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(`no fixture ${name}`);
  return faceOf(card, 0).targets;
}

describe('the target parser', () => {
  test('Lightning Bolt reads "any target" — creature, player, planeswalker or battle', () => {
    const specs = specsOf('Lightning Bolt');
    expect(specs).toHaveLength(1);
    expect(specs[0]?.min).toBe(1);
    expect(specs[0]?.max).toBe(1);
    expect([...(specs[0]?.kinds ?? [])].sort()).toEqual(['battle', 'creature', 'planeswalker', 'player']);
    expect(specs[0]?.confident).toBe(true);
  });

  /**
   * ⚠️ An Aura targets what it will enchant (CR 303.4c) and never says the word.
   * 3,463 Commander-legal faces work this way, so leaving them out would make
   * Auras the one permanent class that never asks you to aim.
   */
  test('Pacifism targets through Enchant, with no "target" in its text', () => {
    const specs = specsOf('Pacifism');
    expect(specs).toHaveLength(1);
    expect(specs[0]?.kinds).toEqual(['creature']);
    expect(specs[0]?.text).toBe('Enchant creature');
  });

  test('a vanilla creature and a basic land have no target clauses', () => {
    expect(specsOf('Grizzly Bears')).toEqual([]);
    expect(specsOf('Forest')).toEqual([]);
  });

  /**
   * ⚠️ Reminder text is an ability the card DESCRIBES, not one it has. Lightning
   * Greaves' "(It can't be the target of spells or abilities.)" would otherwise
   * mint a target requirement on a card that targets nothing.
   */
  test('reminder text never creates a target requirement', () => {
    expect(specsOf('Lightning Greaves')).toEqual([]);
    expect(specsOf('Scaled Behemoth')).toEqual([]);
  });

  test('"can\'t be the target of" and "becomes the target of" are not clauses', () => {
    expect(parseTargetClauses("This creature can't be the target of spells or abilities.")).toEqual([]);
    expect(parseTargetClauses('Whenever this becomes the target of a spell, draw a card.')).toEqual([]);
  });

  test('counts read forwards and backwards', () => {
    const upTo = parseTargetClauses('Destroy up to two target creatures.');
    expect(upTo[0]?.min).toBe(0);
    expect(upTo[0]?.max).toBe(2);
    const two = parseTargetClauses('Destroy two target creatures.');
    expect(two[0]?.min).toBe(2);
    expect(two[0]?.max).toBe(2);
  });

  test('a controller qualifier narrows the clause', () => {
    expect(parseTargetClauses('Target creature you control gets +3/+3.')[0]?.controller).toBe('you');
    expect(parseTargetClauses('Destroy target creature an opponent controls.')[0]?.controller).toBe('opponent');
    // ⚠️ Exact in Commander: with no teammates, "not mine" IS "an opponent's".
    expect(parseTargetClauses("Tap target creature you don't control.")[0]?.controller).toBe('opponent');
  });

  /**
   * ⚠️ THE SAFETY PROPERTY. An unread clause must never make a card uncastable,
   * so it falls to free aim with `min: 0` rather than to a guess.
   */
  test('an unreadable clause becomes free aim and demands nothing', () => {
    const specs = parseSpellTargets('Chandra deals 3 damage divided as you choose among one, two, or three targets.', false);
    expect(specs).toHaveLength(1);
    expect(specs[0]?.kinds).toEqual([]);
    expect(specs[0]?.confident).toBe(false);
    expect(specs[0]?.min).toBe(0);
  });

  /** The kind is enforced; an adjective the engine cannot check is recorded and said on the card. */
  test('an adjective it cannot check is recorded rather than guessed at', () => {
    const spec = parseTargetClauses('Destroy target modified creature.')[0];
    expect(spec?.kinds).toEqual(['creature']);
    expect(spec?.unenforced).toContain('modified');
  });

  /** D294: a colour the engine CAN check is a restriction, not a recorded word. */
  test('an adjective it can check becomes a restriction (D294)', () => {
    const spec = parseTargetClauses('Destroy target nonblack creature.')[0];
    expect(spec?.kinds).toEqual(['creature']);
    expect(spec?.restrict).toEqual({ colorsNone: ['B'] });
    expect(spec?.unenforced).toEqual([]);
  });
});

describe('choosing targets', () => {
  test('casting with no targets stops and asks, carrying the whole prompt', () => {
    const { game, bolt } = boltBoard();
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bolt }));
    const awaiting = game.state.priority.awaiting;
    expect(awaiting?.kind).toBe('chooseTargets');
    if (awaiting?.kind !== 'chooseTargets') throw new Error('no prompt');
    expect(awaiting.count).toBe(1);
    expect(awaiting.specs).toHaveLength(1);
    expect(awaiting.label).toBe('Lightning Bolt');
    expect(awaiting.source).toBe(bolt);
    // Nothing is on the stack yet — the spell is pending, not cast.
    expect(game.state.stack).toHaveLength(0);
  });

  /**
   * ⚠️ This is the case that used to pass silently. `targets: []` was the
   * harness's answer to every prompt, and it stopped being legal the moment a
   * clause could carry `min > 0`.
   */
  test('an empty declaration is refused with illegalTarget', () => {
    const { game, bolt } = boltBoard();
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bolt }));
    const result = game.submit({ t: 'ChooseTargets', player: 'p1', targets: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('illegalTarget');
      expect(result.message).toContain('Lightning Bolt');
    }
  });

  test('a player is a legal target for "any target", and the spell then casts', () => {
    const { game, bolt } = boltBoard();
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bolt }));
    must(game.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    expect(game.state.stack).toHaveLength(1);
    expect(game.state.stack[0]?.targets).toEqual([{ kind: 'player', id: 'p2' }]);
    // The prompt is cleared — leaving it up made every later answer come back
    // "You are not casting anything."
    expect(game.state.priority.awaiting).toBeNull();
  });

  test('a card in hand is not a legal target', () => {
    const { game, bolt } = boltBoard(['Grizzly Bears']);
    const bears = findAnywhere(game, 'p1', 'Grizzly Bears');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'hand', player: 'p1' } }));
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bolt }));
    const result = game.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('illegalTarget');
  });

  test('the one-shot path still works — targets supplied up front never stage', () => {
    const { game, bolt } = boltBoard();
    must(
      game.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }),
    );
    expect(game.state.stack).toHaveLength(1);
    expect(game.state.pendingCast).toBeNull();
  });

  test('cancelling a staged cast puts the card back in hand', () => {
    const { game, bolt } = boltBoard();
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bolt }));
    expect(game.state.cards[bolt]?.zone.kind).toBe('stack');
    must(game.submit({ t: 'CancelPendingCast', player: 'p1' }));
    expect(game.state.cards[bolt]?.zone.kind).toBe('hand');
    expect(game.state.pendingCast).toBeNull();
    expect(game.state.priority.awaiting).toBeNull();
  });
});

describe('the CR restrictions the engine knows', () => {
  /**
   * ⚠️ CR 702.11b — hexproof stops OPPONENTS only. Reading it as "nobody" would
   * stop a player pumping their own hexproof creature, which is a rule players
   * feel immediately.
   */
  test('hexproof stops an opponent and not its controller', () => {
    const game = startedGame({ decks: [['Scaled Behemoth'], []] });
    const behemoth = put(game, 'p1', 'Scaled Behemoth');
    const candidates = candidatesFromState(game.state, deps());
    const target = candidates.find((c) => c.choice.kind === 'card' && c.choice.id === behemoth);
    if (!target) throw new Error('behemoth is not a candidate');
    expect(target.hexproof).toBe(true);
    const spec = specsOf('Lightning Bolt')[0];
    if (!spec) throw new Error('no bolt spec');
    expect(targetAllowed(spec, { controller: 'p2', colors: ['R'] }, target)).toBe(false);
    expect(targetAllowed(spec, { controller: 'p1', colors: ['R'] }, target)).toBe(true);
  });

  /** CR 702.16b — protection from a colour includes "can't be targeted by". */
  test('protection from red refuses a red source and accepts a blue one', () => {
    const game = startedGame({ decks: [['Kor Firewalker']] });
    const walker = put(game, 'p1', 'Kor Firewalker');
    const candidates = candidatesFromState(game.state, deps());
    const target = candidates.find((c) => c.choice.kind === 'card' && c.choice.id === walker);
    if (!target) throw new Error('firewalker is not a candidate');
    const spec = specsOf('Lightning Bolt')[0];
    if (!spec) throw new Error('no bolt spec');
    expect(targetAllowed(spec, { controller: 'p2', colors: ['R'] }, target)).toBe(false);
    expect(targetAllowed(spec, { controller: 'p2', colors: ['U'] }, target)).toBe(true);
  });

  test('"target creature you control" refuses an opponent\'s creature', () => {
    const game = startedGame({ decks: [['Grizzly Bears'], ['Grizzly Bears']] });
    const mine = put(game, 'p1', 'Grizzly Bears');
    const theirs = put(game, 'p2', 'Grizzly Bears');
    const spec = parseTargetClauses('Target creature you control gets +3/+3.')[0];
    if (!spec) throw new Error('no spec');
    const legal = legalTargetsFor(spec, { controller: 'p1', colors: ['G'] }, candidatesFromState(game.state, deps()));
    const ids = legal.map((c: TargetChoice) => c.id);
    expect(ids).toContain(mine);
    expect(ids).not.toContain(theirs);
  });

  test('a dead player is never a candidate', () => {
    const game = startedGame({ decks: [[]] });
    must(game.submit({ t: 'Concede', player: 'p2' }));
    const players = candidatesFromState(game.state, deps()).filter((c) => c.choice.kind === 'player');
    expect(players.map((c) => c.choice.id)).not.toContain('p2');
  });
});

describe('activated abilities', () => {
  /**
   * ⚠️ Krenko's `{T}: Create X …` is payable — mana and a tap are prices the
   * engine can charge. `Sacrifice a creature` and `Pay 3 life` are decisions, and
   * `tier3.ts` names them on the card instead.
   */
  test('a payable {T} ability is offered, and only once it can be tapped', () => {
    const game = startedGame({ decks: [['Krenko, Mob Boss']] });
    const krenko = put(game, 'p1', 'Krenko, Mob Boss');
    // Summoning sick on the turn it arrived: CR 302.6 covers {T} abilities too.
    const sick = legalActions(game.state, ORACLE, game.deps.scripts, 'p1').filter(
      (a) => a.t === 'ActivateAbility' && a.card === krenko,
    );
    expect(sick).toHaveLength(0);
  });

  test('activating an ability leaves the permanent on the battlefield', () => {
    const game = startedGame({ decks: [['Krenko, Mob Boss']] });
    fullControl(game, 'p1');
    const krenko = put(game, 'p1', 'Krenko, Mob Boss');
    // Fast-forward past summoning sickness by clearing the summoned marker the
    // only honest way: advance to a later turn of p1's.
    advanceToMyTurn(game);
    // ⚠️ Asserted, not skipped past. A test that returns early when the board is
    // not what it expected is a test that can silently stop testing anything —
    // which is exactly the failure the fuzzer's target canaries exist to catch.
    const actions = legalActions(game.state, ORACLE, game.deps.scripts, 'p1').filter(
      (a) => a.t === 'ActivateAbility' && a.card === krenko,
    );
    expect(actions).toHaveLength(1);
    must(game.submit({ t: 'ActivateAbility', player: 'p1', card: krenko, abilityIndex: 0 }));
    // ⚠️ The permanent DID NOT MOVE — an ability puts a chit on the stack, not
    // its source. Getting this wrong deletes or duplicates a permanent, and
    // `checkInvariants` cannot see it because it skips stack-zone cards.
    expect(game.state.cards[krenko]?.zone.kind).toBe('battlefield');
    expect(game.state.cards[krenko]?.tapped).toBe(true);
    expect(game.state.stack).toHaveLength(1);
    expect(game.state.stack[0]?.card).toBeNull();
    expect(game.state.stack[0]?.source).toBe(krenko);
  });

  test('a mana ability is refused as an activation — it never uses the stack', () => {
    const game = startedGame({ decks: [['Llanowar Elves']] });
    const elves = put(game, 'p1', 'Llanowar Elves');
    const result = game.submit({ t: 'ActivateAbility', player: 'p1', card: elves, abilityIndex: 0 });
    expect(result.ok).toBe(false);
  });
});

describe('the blocker prompt', () => {
  /**
   * ⚠️ The pairing matrix is what lets the aim veil be honest about blocks. A
   * client cannot compute it — "can a Grizzly Bears block an Air Elemental" needs
   * derived keywords off a `GameState` no client holds — so the host ships it,
   * and a veil that lit up an illegal block would be worse than no veil at all.
   */
  test('the prompt carries which creature may block which attacker', () => {
    // ⚠️ Every seat gets the same board and the attacker/defender come from the
    // PROMPT, not from an assumption about whose turn it is. Hardcoding "p1
    // attacks p2" made this fail with `illegalAttacker` for a reason that had
    // nothing to do with what it was testing.
    const deck = ['Air Elemental', 'Grizzly Bears', 'Giant Spider'];
    const game = startedGame({ decks: [deck, deck, deck, deck] });
    for (const seat of ['p1', 'p2', 'p3', 'p4'] as const) {
      put(game, seat, 'Air Elemental');
      put(game, seat, 'Grizzly Bears');
      put(game, seat, 'Giant Spider');
    }
    advanceToMyTurn(game);

    const awaiting = advanceToPrompt(game, 'declareAttackers');
    expect(awaiting?.kind).toBe('declareAttackers');
    if (awaiting?.kind !== 'declareAttackers') return;
    const attacker = awaiting.player;
    const flier = awaiting.attackers.find((id) => nameOf(game, id) === 'Air Elemental');
    const defender = awaiting.defenders.find((d) => d.kind === 'player' && d.id !== attacker);
    expect(flier).toBeDefined();
    expect(defender).toBeDefined();
    if (!flier || !defender) return;
    must(game.submit({ t: 'DeclareAttackers', player: attacker, attackers: [{ card: flier, defender }] }));

    const blocks = advanceToPrompt(game, 'declareBlockers');
    expect(blocks?.kind).toBe('declareBlockers');
    if (blocks?.kind !== 'declareBlockers') return;
    const defendingSeat = defender.kind === 'player' ? defender.id : attacker;
    const theirs = (name: string) =>
      game.state.zones.battlefield.find(
        (id) => game.state.cards[id]?.controller === defendingSeat && nameOf(game, id) === name,
      );
    const rowFor = (id: string | undefined) => blocks.legal.find((r) => r.blocker === id);

    // Giant Spider has reach and may block a flier; Grizzly Bears may not, so it
    // has no row at all. That distinction is the whole point of shipping the
    // matrix — no client could derive it.
    expect(rowFor(theirs('Giant Spider'))?.attackers).toContain(flier);
    expect(rowFor(theirs('Grizzly Bears'))).toBeUndefined();
    // The defender's OWN flier can block it too.
    expect(rowFor(theirs('Air Elemental'))?.attackers).toContain(flier);
  });
});

/** Pass priority until a specific prompt is up, or give up. */
function advanceToPrompt(
  game: Game,
  kind: string,
): NonNullable<ReturnType<() => typeof game.state.priority.awaiting>> | null {
  for (let i = 0; i < 4000; i++) {
    const awaiting = game.state.priority.awaiting;
    if (awaiting?.kind === kind) return awaiting;
    if (awaiting) return null;
    const holder = game.state.priority.player;
    if (!holder) return null;
    const r = game.submit({ t: 'PassPriority', player: holder });
    if (!r.ok) return null;
  }
  return null;
}

/** Advance until it is p1's turn again, so a permanent loses summoning sickness. */
function advanceToMyTurn(game: Game): void {
  for (let i = 0; i < 4000; i++) {
    if (game.state.turn.activePlayer === 'p1' && game.state.turn.turnNumber > 1) return;
    const awaiting = game.state.priority.awaiting;
    if (awaiting) return;
    const holder = game.state.priority.player;
    if (!holder) return;
    const r = game.submit({ t: 'PassPriority', player: holder });
    if (!r.ok) return;
  }
}
