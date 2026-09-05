// `Mistmeadow Council` - a etb trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MISTMEADOW_COUNCIL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MISTMEADOW_COUNCIL, "This spell costs {1} less to cast if you control a Kithkin.\nWhen this creature enters, draw a card.");
const LINES = PRINTED.split('\n');

export const MISTMEADOW_COUNCIL_SCRIPT: CardScript = {
  oracleId: MISTMEADOW_COUNCIL.oracleId,
  name: MISTMEADOW_COUNCIL.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Mistmeadow Council - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
