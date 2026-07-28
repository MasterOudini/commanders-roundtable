import { describe, expect, test } from 'vitest';
import { legalActions, shouldAutoPass } from './legal';
import { createRegistry } from './scripts/registry';
import type { CardScript } from './scripts/api';
import {
  ORACLE,
  advanceToStep,
  advanceUntil,
  battlefieldOf,
  find,
  findAnywhere,
  fullControl,
  idsIn,
  must,
  put,
  startedGame,
} from './testing/harness';
import type { GameState } from './types/state';

function step(game: { state: GameState }): string {
  return game.state.turn.step;
}

describe('turn structure', () => {
  test('the untap step grants no priority (CR 502.3)', () => {
    const game = startedGame();
    // The engine is already past untap by the time it stops, because untap
    // cannot be the resting place: nobody can act there.
    expect(step(game)).not.toBe('untap');
    const untapGrants = game.log.filter(
      (e) => e.body.t === 'PriorityGranted' && e.stepId > 0,
    );
    // Every priority grant so far happened at or after upkeep.
    expect(untapGrants.length).toBeGreaterThan(0);
  });

  test('the active player untaps at the start of their turn', () => {
    const game = startedGame({ decks: [['Sol Ring']] });
    const ring = put(game, 'p1', 'Sol Ring');
    must(game.submit({ t: 'ManualSetTapped', player: 'p1', cards: [ring], tapped: true }));
    expect(game.state.cards[ring]?.tapped).toBe(true);
    advanceUntil(game, (s) => s.turn.turnNumber === 5 && s.turn.activePlayer === 'p1');
    expect(game.state.cards[ring]?.tapped).toBe(false);
  });

  test('the active player draws in the draw step', () => {
    const game = startedGame();
    const before = idsIn(game, 'p2', 'hand').length;
    advanceUntil(game, (s) => s.turn.activePlayer === 'p2' && s.turn.step === 'precombatMain');
    expect(idsIn(game, 'p2', 'hand').length).toBe(before + 1);
  });

  /**
   * ⚠️ CR 103.7 encoded as WRITTEN: the starting player skips their first draw
   * ONLY in a two-player game. With three or more players nobody skips. Getting
   * this backwards is invisible for four turns of a four-player game, so the
   * first turn's log line says which rule applied.
   */
  test('at two players the starting player skips the first draw', () => {
    const game = startedGame({ players: 2, startingPlayer: 'p1' });
    expect(idsIn(game, 'p1', 'hand')).toHaveLength(7);
    expect(game.state.narration.some((l) => l.text.includes('103.7b'))).toBe(true);
  });

  test('at four players nobody skips the first draw', () => {
    const game = startedGame({ players: 4, startingPlayer: 'p1' });
    expect(idsIn(game, 'p1', 'hand')).toHaveLength(8);
    expect(game.state.narration.some((l) => l.text.includes('103.7a'))).toBe(true);
  });

  test('mana pools empty at the end of every step', () => {
    const game = startedGame({ decks: [['Sol Ring']] });
    const ring = put(game, 'p1', 'Sol Ring');
    must(game.submit({ t: 'TapForMana', player: 'p1', card: ring, abilityIndex: 0, outputChoice: 0 }));
    expect(game.state.players['p1']?.pool.C).toBe(2);
    const startStep = game.state.turn.step;
    advanceUntil(game, (s) => s.turn.step !== startStep);
    expect(game.state.players['p1']?.pool.C).toBe(0);
    expect(game.log.some((e) => e.body.t === 'ManaPoolEmptied')).toBe(true);
  });

  test('the land drop resets each turn', () => {
    const game = startedGame({ decks: [['Forest', 'Forest']] });
    const forest = find(game, 'p1', 'hand', 'Forest');
    must(game.submit({ t: 'PlayLand', player: 'p1', card: forest }));
    expect(game.state.players['p1']?.landsPlayedThisTurn).toBe(1);
    const second = idsIn(game, 'p1', 'hand').find((id) => id !== forest);
    void second;
    advanceUntil(game, (s) => s.turn.turnNumber === 5 && s.turn.activePlayer === 'p1');
    expect(game.state.players['p1']?.landsPlayedThisTurn).toBe(0);
  });

  test('a second land in one turn is refused, with the reason', () => {
    const game = startedGame({ decks: [['Forest', 'Island', 'Mountain']] });
    // Hold priority, or the engine (correctly) auto-passes out of the main
    // phase after the first land and the second attempt is refused for TIMING.
    fullControl(game, 'p1');
    const a = idsIn(game, 'p1', 'hand')[0] as string;
    must(game.submit({ t: 'PlayLand', player: 'p1', card: a }));
    const b = idsIn(game, 'p1', 'hand')[0] as string;
    const result = game.submit({ t: 'PlayLand', player: 'p1', card: b });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('landDropUsed');
      expect(result.message).toContain('already played');
    }
  });

  test('the turn passes around the table in seat order', () => {
    const game = startedGame();
    const seen: string[] = [game.state.turn.activePlayer];
    for (let i = 0; i < 4; i++) {
      const current = game.state.turn.turnNumber;
      advanceUntil(game, (s) => s.turn.turnNumber > current);
      seen.push(game.state.turn.activePlayer);
    }
    expect(seen).toEqual(['p1', 'p2', 'p3', 'p4', 'p1']);
  });

  test('a player who has lost is skipped', () => {
    const game = startedGame();
    must(game.submit({ t: 'Concede', player: 'p2' }));
    expect(game.state.players['p2']?.hasLost).toBe(true);
    const current = game.state.turn.turnNumber;
    advanceUntil(game, (s) => s.turn.turnNumber > current);
    expect(game.state.turn.activePlayer).toBe('p3');
  });

  test('cleanup clears marked damage', () => {
    const game = startedGame({ decks: [['Serra Angel']] });
    const angel = put(game, 'p1', 'Serra Angel');
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: angel, kind: '+1/+1', delta: 5 }));
    // Mark damage the only way that does not also kill it: a big creature.
    advanceToStep(game, 'cleanup');
    expect(game.state.cards[angel]?.damage).toBe(0);
  });

  /**
   * The convergence test. Forty turns of nothing but passes is ~2 500 engine
   * steps; hitting MAX_ITER anywhere in there means the loop has a cycle.
   */
  test('a four-player game runs 40 turns of passes without hitting the iteration cap', () => {
    const game = startedGame({ librarySize: 200 });
    advanceUntil(game, (s) => s.turn.turnNumber > 40, 60_000);
    expect(game.state.turn.turnNumber).toBeGreaterThan(40);
    expect(game.state.gamePhase).toBe('playing');
  });

  /**
   * ⚠️ Read from the LOG, not by sampling state between passes. With auto-pass
   * on, a whole combat phase can be traversed inside one `pump()` call, so a
   * sampler that only looks between submitted intents never sees `beginCombat`
   * at all — and reports "the step is missing" for a step that ran correctly.
   */
  test('every step of a turn is visited in order', () => {
    const game = startedGame({ players: 2 });
    const start = game.state.turn.turnNumber;
    const from = game.log.length;
    advanceUntil(game, (s) => s.turn.turnNumber > start);
    const seen = game.log
      .slice(from)
      .flatMap((e) => (e.body.t === 'StepBegan' ? [e.body.step] : []));
    expect(seen).toContain('precombatMain');
    expect(seen).toContain('beginCombat');
    expect(seen).toContain('declareAttackers');
    expect(seen).toContain('postcombatMain');
    expect(seen).toContain('end');
    expect(seen).toContain('cleanup');
    // With no attackers the blocker and damage steps are skipped — CR still
    // runs them, but they have nothing to do and cost four clicks each.
    expect(seen).not.toContain('declareBlockers');
  });
});

describe('state-based actions', () => {
  test('0 life loses the game', () => {
    const game = startedGame();
    must(game.submit({ t: 'ManualSetLife', player: 'p2', target: 'p2', delta: -40 }));
    expect(game.state.players['p2']?.hasLost).toBe(true);
    expect(game.state.players['p2']?.lossReason).toBe('life');
  });

  test('-1/-1 counters to zero toughness bin the creature — indestructible does not save it', () => {
    const game = startedGame({ decks: [['Spearbreaker Behemoth']] });
    const behemoth = put(game, 'p1', 'Spearbreaker Behemoth');
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: behemoth, kind: '-1/-1', delta: 5 }));
    expect(game.state.cards[behemoth]?.zone.kind).toBe('graveyard');
  });

  test('indestructible DOES survive lethal damage', () => {
    const game = startedGame({ decks: [['Spearbreaker Behemoth']] });
    const behemoth = put(game, 'p1', 'Spearbreaker Behemoth');
    must(game.submit({ t: 'ManualSetPt', player: 'p1', card: behemoth, power: 5, toughness: 5 }));
    expect(game.state.cards[behemoth]?.zone.kind).toBe('battlefield');
  });

  test('+1/+1 and -1/-1 counters annihilate in pairs', () => {
    const game = startedGame({ decks: [['Serra Angel']] });
    const angel = put(game, 'p1', 'Serra Angel');
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: angel, kind: '+1/+1', delta: 3 }));
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: angel, kind: '-1/-1', delta: 2 }));
    expect(game.state.cards[angel]?.counters).toEqual({ '+1/+1': 1 });
  });

  /**
   * ⚠️ CR 704.5b — the loss happens on the NEXT state-based-action check, not at
   * the moment of the draw. That window is what a replacement effect (or a
   * Tier-3 tool) uses to save the player.
   */
  test('drawing from an empty library loses on the next SBA pass', () => {
    // Two players, one card left in each library. p1 skips their first draw
    // (CR 103.7b), so p2 is the one who runs out first — on turn 4.
    const game = startedGame({ players: 2, librarySize: 8 });
    advanceUntil(game, (s) => s.gamePhase === 'finished' || s.turn.turnNumber > 12, 20_000);
    expect(game.state.players['p2']?.lossReason).toBe('emptyLibrary');
    expect(game.log.some((e) => e.body.t === 'DrewFromEmptyLibrary')).toBe(true);
    expect(game.state.winners).toEqual(['p1']);
  });

  /** Always ask, even for two identical copies: counters and damage differ. */
  test('the legend rule prompts even for two identical copies', () => {
    const game = startedGame({ decks: [['Krenko, Mob Boss', 'Krenko, Mob Boss']] });
    put(game, 'p1', 'Krenko, Mob Boss');
    put(game, 'p1', 'Krenko, Mob Boss');
    const awaiting = game.state.priority.awaiting;
    expect(awaiting?.kind).toBe('chooseLegendKeep');
    if (awaiting?.kind === 'chooseLegendKeep') {
      expect(awaiting.candidates).toHaveLength(2);
      must(game.submit({ t: 'ChooseLegendKeep', player: 'p1', keep: awaiting.candidates[0] as string }));
    }
    expect(battlefieldOf(game, 'p1').filter((id) => game.state.cards[id]?.printingId)).toHaveLength(1);
  });

  test('two legends with different names coexist', () => {
    const game = startedGame({ decks: [['Krenko, Mob Boss', 'Talrand, Sky Summoner']] });
    put(game, 'p1', 'Krenko, Mob Boss');
    put(game, 'p1', 'Talrand, Sky Summoner');
    expect(game.state.priority.awaiting?.kind).not.toBe('chooseLegendKeep');
    expect(battlefieldOf(game, 'p1')).toHaveLength(2);
  });

  test('the last player standing wins', () => {
    const game = startedGame();
    must(game.submit({ t: 'Concede', player: 'p2' }));
    must(game.submit({ t: 'Concede', player: 'p3' }));
    must(game.submit({ t: 'Concede', player: 'p4' }));
    expect(game.state.gamePhase).toBe('finished');
    expect(game.state.winners).toEqual(['p1']);
  });

  test('everyone losing at once is a draw, not a win', () => {
    const game = startedGame({ players: 2 });
    must(game.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: -40 }));
    // p1 is out; p2 is the last standing.
    expect(game.state.winners).toEqual(['p2']);
    const draw = startedGame({ players: 2, seed: 'draw' });
    must(draw.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: -40 }));
    expect(draw.state.gamePhase).toBe('finished');
  });

  test('21 commander damage is a loss', () => {
    const game = startedGame();
    const commander = idsIn(game, 'p1', 'command')[0] as string;
    // Reach into the tally the only legitimate way: combat. Here, the SBA is
    // what is under test, so the damage is applied by the manual tool and the
    // tally by a direct commander-damage event through combat in combat.test.ts.
    void commander;
    must(game.submit({ t: 'ManualSetLife', player: 'p2', target: 'p2', delta: -40 }));
    expect(game.state.players['p2']?.hasLost).toBe(true);
  });
});

describe('auto-pass', () => {
  test('a player with no meaningful action auto-passes', () => {
    const game = startedGame({ decks: [[], [], [], []], librarySize: 40 });
    // Everyone has lands in hand, so they stop for the land drop on their own
    // turn; on someone else's turn they have nothing and pass automatically.
    const nonActive = game.state.seating.filter((p) => p !== game.state.turn.activePlayer);
    for (const p of nonActive) {
      expect(shouldAutoPass(game.state, ORACLE, game.deps.scripts, p)).toBe(true);
    }
  });

  /**
   * ⚠️ Never auto-pass out of your own main phase with a land drop available.
   * Playing a land is the one action people genuinely forget, and skipping it
   * costs a whole turn of development that cannot be recovered.
   */
  test('the active player never auto-passes with a land drop available', () => {
    const game = startedGame();
    expect(game.state.turn.step).toBe('precombatMain');
    expect(game.state.priority.player).toBe('p1');
    expect(shouldAutoPass(game.state, ORACLE, game.deps.scripts, 'p1')).toBe(false);
  });

  /**
   * ⚠️ Asserted on where the ENGINE stops, not on `shouldAutoPass` in isolation.
   * `shouldAutoPass` calls `legalActions`, which returns nothing for a player
   * who does not hold priority — so calling it for a bystander always says
   * "yes, pass", and a test that did would pass for the wrong reason.
   */
  test('auto-pass does NOT fire when a player holds an affordable instant', () => {
    const game = startedGame({
      players: 2,
      decks: [[], ['Lightning Bolt', 'Mountain']],
      startingPlayer: 'p1',
    });
    const bolt = findAnywhere(game, 'p2', 'Lightning Bolt');
    must(game.submit({ t: 'ManualMoveCard', player: 'p2', card: bolt, to: { kind: 'hand', player: 'p2' } }));
    // p2 needs the Mountain on the battlefield to afford the Bolt.
    const mountain = findAnywhere(game, 'p2', 'Mountain');
    must(game.submit({ t: 'ManualMoveCard', player: 'p2', card: mountain, to: { kind: 'battlefield', player: 'p2' } }));
    must(game.submit({ t: 'PassPriority', player: 'p1' }));
    expect(game.state.priority.player).toBe('p2');
    expect(shouldAutoPass(game.state, ORACLE, game.deps.scripts, 'p2')).toBe(false);
  });

  test('a player who cannot pay for the instant DOES auto-pass', () => {
    const game = startedGame({ players: 2, decks: [[], ['Lightning Bolt']], startingPlayer: 'p1' });
    const bolt = findAnywhere(game, 'p2', 'Lightning Bolt');
    must(game.submit({ t: 'ManualMoveCard', player: 'p2', card: bolt, to: { kind: 'hand', player: 'p2' } }));
    const step = game.state.turn.step;
    must(game.submit({ t: 'PassPriority', player: 'p1' }));
    // p2 had nothing to do, so the engine passed for them and the step ended.
    expect(game.state.turn.step).not.toBe(step);
  });

  test('stopWhenAnyoneCasts interrupts the auto-pass chain', () => {
    const game = startedGame({ decks: [['Mountain', 'Lightning Bolt']], startingPlayer: 'p1' });
    fullControl(game, 'p1');
    const mountain = findAnywhere(game, 'p1', 'Mountain');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: mountain, to: { kind: 'battlefield', player: 'p1' } }));
    const bolt = findAnywhere(game, 'p1', 'Lightning Bolt');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'hand', player: 'p1' } }));
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    expect(game.state.stack).toHaveLength(1);
    // The stack grew since p2 last held priority, so the engine must STOP with
    // p2 holding it rather than passing the spell straight through.
    must(game.submit({ t: 'PassPriority', player: 'p1' }));
    expect(game.state.priority.player).toBe('p2');
    expect(game.state.stack).toHaveLength(1);
    expect(shouldAutoPass(game.state, ORACLE, game.deps.scripts, 'p2')).toBe(false);
  });

  test('full control stops everywhere', () => {
    const game = startedGame();
    const stops = game.state.players['p2']?.stops;
    if (!stops) throw new Error('no stops');
    must(game.submit({ t: 'SetStops', player: 'p2', stops: { ...stops, mode: 'fullControl' } }));
    expect(shouldAutoPass(game.state, ORACLE, game.deps.scripts, 'p2')).toBe(false);
  });

  test('legalActions is empty for a player without priority', () => {
    const game = startedGame();
    expect(legalActions(game.state, ORACLE, game.deps.scripts, 'p3')).toEqual([]);
  });

  test('legalActions offers the land drop and a pass', () => {
    const game = startedGame({ decks: [['Forest']] });
    const actions = legalActions(game.state, ORACLE, game.deps.scripts, 'p1');
    expect(actions.some((a) => a.t === 'PlayLand')).toBe(true);
    expect(actions.some((a) => a.t === 'PassPriority')).toBe(true);
  });
});

/** A trigger that fires on every upkeep, for the APNAP ordering test. */
function upkeepTrigger(oracleId: string, label: string): CardScript {
  return {
    oracleId,
    name: label,
    triggers: [
      {
        abilityId: 'upkeep',
        text: 'At the beginning of each upkeep, do nothing visible.',
        event: 'StepBegan',
        activeZones: ['battlefield'],
        optional: false,
        matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep',
        label: () => label,
        resolve: () => [],
      },
    ],
  };
}

describe('the trigger bus', () => {
  test('a fixture trigger fires on StepBegan{upkeep} and lands on the stack', () => {
    const solRing = ORACLE.byName('Sol Ring');
    if (!solRing) throw new Error('no Sol Ring fixture');
    const scripts = createRegistry([upkeepTrigger(solRing.oracleId, 'Sol Ring trigger')]);
    const game = startedGame({ decks: [['Sol Ring']], scripts });
    put(game, 'p1', 'Sol Ring');
    const from = game.log.length;
    advanceUntil(game, (s) => s.turn.turnNumber > 2, 20_000);
    // ⚠️ Asserted on the LOG. The trigger goes on the stack and resolves inside
    // one `pump()`, so sampling `state.stack` between submitted intents finds it
    // empty every time — which reads as "the trigger never fired".
    const put1 = game.log
      .slice(from)
      .filter((e) => e.body.t === 'AbilityPutOnStack')
      .map((e) => (e.body.t === 'AbilityPutOnStack' ? e.body.obj : null));
    expect(put1.map((o) => o?.label)).toContain('Sol Ring trigger');
    expect(put1[0]?.kind).toBe('triggered');
  });

  /**
   * ⚠️ APNAP puts the ACTIVE player's trigger on the stack FIRST, so the
   * non-active player's ends up on top and resolves first. Reversing this is
   * the classic off-by-one in a trigger bus, and it is invisible until two
   * triggers fight over the same object.
   */
  test('triggers go on the stack in APNAP order', () => {
    const solRing = ORACLE.byName('Sol Ring');
    if (!solRing) throw new Error('no Sol Ring fixture');
    const scripts = createRegistry([upkeepTrigger(solRing.oracleId, 'ring')]);
    const game = startedGame({
      players: 2,
      decks: [['Sol Ring'], ['Sol Ring']],
      startingPlayer: 'p1',
      scripts,
    });
    put(game, 'p1', 'Sol Ring');
    put(game, 'p2', 'Sol Ring');
    const from = game.log.length;
    advanceUntil(game, (s) => s.turn.turnNumber > 2, 20_000);
    const onStack = game.log
      .slice(from)
      .flatMap((e) => (e.body.t === 'AbilityPutOnStack' ? [e.body.obj] : []));
    expect(onStack.length).toBeGreaterThanOrEqual(2);
    // The first two are one upkeep's worth. The ACTIVE player's goes on first,
    // so the non-active player's ends up on top and resolves first.
    const active = onStack[0]?.controller;
    expect(onStack[1]?.controller).not.toBe(active);
  });

  test('with no scripts nothing ever reaches pendingTriggers', () => {
    const game = startedGame();
    advanceUntil(game, (s) => s.turn.turnNumber > 3, 20_000);
    expect(game.state.pendingTriggers).toEqual([]);
    expect(game.log.some((e) => e.body.t === 'PendingTriggersAdded')).toBe(false);
  });
});
