// `Merchant of Secrets` — "When this creature enters, draw a card." Wall of
// Omens's line on a Wizard, through THE one draw rule. M6.4ad, D186.

import { MERCHANT_OF_SECRETS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(MERCHANT_OF_SECRETS, 'When this creature enters, draw a card.');

export const MERCHANT_OF_SECRETS_SCRIPT: CardScript = {
  oracleId: MERCHANT_OF_SECRETS.oracleId,
  name: MERCHANT_OF_SECRETS.name,
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
      label: () => 'Merchant of Secrets — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
