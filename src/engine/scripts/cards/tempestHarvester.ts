// `Tempest Harvester` - a etb trigger vocab, an activation loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TEMPEST_HARVESTER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(TEMPEST_HARVESTER, "When this creature enters, you get {E}{E} (two energy counters).\n{T}, Pay {E}: Draw a card, then discard a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You get {E}{E}.", TEMPEST_HARVESTER.name);
const VOCAB_T_L0 = vocabularyTargets("You get {E}{E}.");

export const TEMPEST_HARVESTER_SCRIPT: CardScript = {
  oracleId: TEMPEST_HARVESTER.oracleId,
  name: TEMPEST_HARVESTER.name,
  activated: [
    {
      ref: `${TEMPEST_HARVESTER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Tempest Harvester - discard a card" } },
        ];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Tempest Harvester - You get {E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
