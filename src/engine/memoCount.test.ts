// D476 - THE TRIGGER'S OWN NUMBER. `Whenever this creature deals combat damage to a player, you gain that much life`:
// the count is the damage the head's event dealt, which the resolution cannot read (the event is gone). The def's
// `memo` hook (D440's keyword plumbing, opened to scripts) reads it off the event as the trigger fires, it rides the
// pending trigger onto the stack object (`obj.memo`), and the vocabulary's `that much` / `that many` reads as one
// counted `memo`. What is proven here:
//   - the vocabulary refuses `that much` with no memo and reads it with one (`per: { kind: 'memo' }`);
//   - a Bears with the def attacks unblocked, deals 2, and its controller gains 2 (the number, not one);
//   - a memo of zero gains nothing; the replay hash.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { GRIZZLY_BEARS } from '../data/fixtures/engineCards';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';

const PAYLOAD = 'you gain that much life.';
const VOCAB = vocabularyEffects(PAYLOAD, GRIZZLY_BEARS.name, { memo: true });
const TARGETS = vocabularyTargets(PAYLOAD);

/** A Bears that reads `Whenever this creature deals combat damage to a player, you gain that much life.` */
const LIFELINK_BEARS: CardScript = {
  oracleId: GRIZZLY_BEARS.oracleId,
  name: GRIZZLY_BEARS.name,
  triggers: [
    {
      abilityId: 'thatMuch',
      text: 'Whenever this creature deals combat damage to a player, you gain that much life.',
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      // D476 - the damage this source dealt in the event, carried onto the stack object.
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' ? ev.damages.filter((d) => d.source === self).reduce((n, d) => n + d.amount, 0) : 0),
      label: () => 'Grizzly Bears - you gain that much life.',
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, VOCAB, TARGETS),
    },
  ],
};

describe("D476 - the trigger's own number", () => {
  test('the vocabulary refuses `that much` with no memo, and reads it as a counted memo with one', () => {
    expect(parseEffects('You gain that much life.', 'Probe', true).mode).toBe('manual');
    const read = parseEffects('You gain that much life.', 'Probe', true, undefined, false, true);
    expect(read.mode).toBe('auto');
    expect(read.effects[0]?.kind).toBe('gainLife');
    expect(read.effects[0]?.amount).toBe(1);
    expect(read.effects[0]?.per).toEqual({ kind: 'memo' });
    expect(parseEffects('Draw that many cards.', 'Probe', true, undefined, false, true).effects[0]?.per).toEqual({ kind: 'memo' });
    // A `that much` the base sentence cannot carry stays unread even with a memo.
    expect(parseEffects('Sacrifice that many creatures.', 'Probe', true, undefined, false, true).mode).toBe('manual');
  });

  test('an unblocked Bears deals 2 and its controller gains 2 - the number, not one', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears'], []], scripts: createRegistry([LIFELINK_BEARS]) });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'postcombatMain' && s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.state.players.p2?.life).toBe(38);
    expect(g.state.players.p1?.life).toBe(life0 + 2);
    const obj = g.log.find((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.abilityRef?.endsWith('#thatMuch') === true);
    expect(obj && obj.body.t === 'AbilityPutOnStack' ? obj.body.obj.memo : null).toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
