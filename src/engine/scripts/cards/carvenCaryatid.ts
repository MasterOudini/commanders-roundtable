// `Carven Caryatid` — "Defender\nWhen this creature enters, draw a card."
// Wall of Omens's shape (M6.4a's own first batch), one arc later. M6.4i,
// D166.

import { CARVEN_CARYATID } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  CARVEN_CARYATID,
  "Defender (This creature can't attack.)\nWhen this creature enters, draw a card.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const CARVEN_CARYATID_SCRIPT: CardScript = {
  oracleId: CARVEN_CARYATID.oracleId,
  name: CARVEN_CARYATID.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Carven Caryatid — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
