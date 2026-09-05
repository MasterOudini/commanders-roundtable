// `Temur Tawnyback` - a etb trigger loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TEMUR_TAWNYBACK } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(TEMUR_TAWNYBACK, "When this creature enters, draw a card, then discard a card.");

export const TEMUR_TAWNYBACK_SCRIPT: CardScript = {
  oracleId: TEMUR_TAWNYBACK.oracleId,
  name: TEMUR_TAWNYBACK.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Temur Tawnyback - loot",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Temur Tawnyback - discard a card" } },
        ];
      },
    },
  ],
};
