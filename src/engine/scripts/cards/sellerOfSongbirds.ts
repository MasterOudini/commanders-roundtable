// `Seller of Songbirds` — "When this creature enters, create a 1/1 white
// Bird creature token with flying." The trtr-1 pin, reused. D245.

import { SELLER_OF_SONGBIRDS } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

const TEXT = printed(
  SELLER_OF_SONGBIRDS,
  'When this creature enters, create a 1/1 white Bird creature token with flying.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const BIRD = tokenRef('Bird|1/1|W|Creature|flying');

export const SELLER_OF_SONGBIRDS_SCRIPT: CardScript = {
  oracleId: SELLER_OF_SONGBIRDS.oracleId,
  name: SELLER_OF_SONGBIRDS.name,
  triggers: [
    {
      abilityId: 'etb-bird',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Seller of Songbirds — create a 1/1 Bird with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: BIRD.oracleId,
          printingId: BIRD.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
