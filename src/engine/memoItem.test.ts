// D477 - THE NUMBER TAKEN. A per-item firing hands its ITEM to the memo hook: `Whenever a creature you control deals
// combat damage to a player, you gain that much life` fires once per creature (CR 603.2c), each firing carrying THAT
// creature's damage. What is proven here: a Bears and a Hill Giant attack unblocked under an Aura-less script on the
// Bears with the head; two triggers go on the stack with memos 2 and 3; the controller gains 5; the replay hash.
import { describe, expect, test } from 'vitest';
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

/** A Bears that reads `Whenever a creature you control deals combat damage to a player, you gain that much life.` */
const NOBLE_BEARS: CardScript = {
  oracleId: GRIZZLY_BEARS.oracleId,
  name: GRIZZLY_BEARS.name,
  triggers: [
    {
      abilityId: 'perCreature',
      text: 'Whenever a creature you control deals combat damage to a player, you gain that much life.',
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self)),
      // One firing per creature of the controller's that dealt damage to a player, in the event's order.
      perItem: (ctx, self, ev) => (ev.t === 'CombatDamageDealt' ? [...new Set(ev.damages.filter((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self)).map((d) => d.source))] : []),
      // D477 - the item's own damage, not the batch's.
      memo: (_ctx, _self, ev, item) => (ev.t === 'CombatDamageDealt' ? ev.damages.filter((d) => d.source === item && d.target.kind === 'player').reduce((n, d) => n + d.amount, 0) : 0),
      label: () => 'Grizzly Bears - you gain that much life.',
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, VOCAB, TARGETS),
    },
  ],
};

describe("D477 - the number taken: a per-item firing's memo is the item's", () => {
  test('a Bears and a Hill Giant attack unblocked: two triggers carrying 2 and 3, the controller gains 5', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Hill Giant'], []], scripts: createRegistry([NOBLE_BEARS]) });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const giant = put(g, 'p1', 'Hill Giant');
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }, { card: giant, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'postcombatMain' && s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.state.players.p2?.life).toBe(35);
    expect(g.state.players.p1?.life).toBe(life0 + 5);
    const memos = g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.abilityRef?.endsWith('#perCreature') === true).map((e) => (e.body.t === 'AbilityPutOnStack' ? e.body.obj.memo : null));
    expect(memos.sort()).toEqual([2, 3]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
