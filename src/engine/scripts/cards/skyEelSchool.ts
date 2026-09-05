// `Sky-Eel School` - a etb trigger loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKY_EEL_SCHOOL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKY_EEL_SCHOOL, "Flying\nWhen this creature enters, draw a card, then discard a card.");
const LINES = PRINTED.split('\n');

export const SKY_EEL_SCHOOL_SCRIPT: CardScript = {
  oracleId: SKY_EEL_SCHOOL.oracleId,
  name: SKY_EEL_SCHOOL.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sky-Eel School - loot",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Sky-Eel School - discard a card" } },
        ];
      },
    },
  ],
};
