// D598 - THE HOST REFERENT: `Put a +1/+1 counter on enchanted creature.`, `Untap enchanted creature.`, `Equipped creature
// gets +2/+2 until end of turn.` - the clause's object is the permanent the SOURCE is attached to (CR 303.4 / 301.5: the
// enchanted or equipped object), no target. The vocabulary read none of them, so every Aura and Equipment whose trigger
// or activated ability acts on its own host stayed blocked. `host` aims the clause at the source's `attachedTo`, asked as
// it resolves: a source that has left the battlefield or is attached to nothing - and a host that has left - is a subject
// that is gone, said and never silent (D90). What is proven: the vocabulary reads the ten verbs on either host noun with no
// target; an upkeep trigger on Lightning Greaves puts its counter on the equipped Bears, untaps it, pumps it; an unattached
// Greaves does nothing; the hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { checkInvariants } from './invariants';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const GREAVES = 'Lightning Greaves';

/** An upkeep head on Lightning Greaves whose payload the vocabulary reads (the generated vocab shape). */
function head(payload: string): CardScript {
  const card = ORACLE.byName(GREAVES);
  if (!card) throw new Error('Lightning Greaves is not in the fixtures');
  const effects = vocabularyEffects(payload, GREAVES);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name: GREAVES,
    triggers: [{
      abilityId: 'upkeep-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => GREAVES + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

/** Greaves and the Bears on p1's side; the Greaves equipped to the Bears in the first main phase unless `bare`. */
function armed(payload: string, bare = false): { g: Game; greaves: string; bears: string } {
  const g = startedGame({ players: 2, decks: [[GREAVES, 'Grizzly Bears', ...TEN], ['Walking Corpse', ...TEN]], scripts: createRegistry([head(payload)]) });
  settle(g);
  holdEverywhere(g);
  const greaves = put(g, 'p1', GREAVES);
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  if (!bare) {
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: greaves, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[greaves]?.attachedTo, 'equipped').toBe(bears);
  }
  return { g, greaves, bears };
}

/** Walk to p1's next upkeep with the trigger waiting on the stack. */
function toUpkeep(g: Game): void {
  const turn = g.state.turn.turnNumber;
  advanceUntil(g, (s) => s.turn.turnNumber > turn && s.turn.activePlayer === 'p1' && s.turn.step === 'upkeep' && s.stack.length === 1 && s.priority.awaiting === null, 40_000);
}
/** Walk to p1's next upkeep trigger resolving. */
function fire(g: Game): void {
  toUpkeep(g);
  settle(g);
}

describe('D598 - the host referent', () => {
  test('the vocabulary reads the verbs on the host with no target', () => {
    const cases: Array<[string, string]> = [
      ['Put a +1/+1 counter on enchanted creature.', 'putCounters'],
      ['Put two -1/-1 counters on equipped creature.', 'putCounters'],
      ['Remove a +1/+1 counter from enchanted creature.', 'removeCounters'],
      ['Untap enchanted creature.', 'untap'],
      ['Untap equipped creature.', 'untap'],
      ['Tap enchanted permanent.', 'tap'],
      ['Destroy enchanted creature.', 'destroy'],
      ['Exile enchanted creature.', 'exile'],
      ["Return enchanted creature to its owner's hand.", 'bounce'],
      ['Enchanted creature gets +2/+2 until end of turn.', 'pump'],
      ['Equipped creature gets +1/+0 and gains first strike until end of turn.', 'pump'],
      ['Equipped creature gains hexproof until end of turn.', 'pump'],
      ['~ deals 2 damage to enchanted creature.', 'damage'],
      ['Regenerate equipped creature.', 'regenerate'],
    ];
    for (const [text, kind] of cases) {
      const effects = vocabularyEffects(text, 'Test Aura');
      expect(effects.map((e) => e.kind), text).toEqual([kind]);
      expect(effects[0]?.host, text).toBe(true);
      expect(effects[0]?.self, text).toBe(false);
      expect(effects[0]?.targetIndex, text).toBe(-1);
      expect(vocabularyTargets(text), text).toEqual([]);
    }
    const pump = vocabularyEffects('Equipped creature gets +1/+0 and gains first strike until end of turn.', 'Test');
    expect([pump[0]?.power, pump[0]?.toughness, pump[0]?.keywords]).toEqual([1, 0, ['firstStrike']]);
  });

  test('an upkeep trigger puts its counter on the equipped creature, never on the Equipment', () => {
    const { g, greaves, bears } = armed('Put a +1/+1 counter on equipped creature.');
    fire(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
    expect(g.state.cards[greaves]?.counters['+1/+1'] ?? 0).toBe(0);
    expect(checkInvariants(g.state)).toEqual([]);
    hashHolds(g);
  });

  test('an upkeep trigger untaps the equipped creature', () => {
    const { g, bears } = armed('Untap equipped creature.');
    // tapped while the trigger waits on the stack (after the untap step), so only the trigger can untap it
    toUpkeep(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    expect(g.state.cards[bears]?.tapped).toBe(true);
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(false);
  });

  test('an upkeep trigger pumps the equipped creature until end of turn', () => {
    const { g, bears } = armed('Equipped creature gets +2/+2 until end of turn.');
    fire(g);
    expect(g.log.some((x) => x.body.t === 'PtModifiedUntilEndOfTurn' && x.body.card === bears && x.body.power === 2 && x.body.toughness === 2)).toBe(true);
  });

  test('an Equipment attached to nothing does nothing (the subject is gone, and said)', () => {
    const { g, greaves, bears } = armed('Put a +1/+1 counter on equipped creature.', true);
    fire(g);
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0).toBe(0);
    expect(g.state.cards[greaves]?.counters['+1/+1'] ?? 0).toBe(0);
    hashHolds(g);
  });
});
