// `Selesnya Evangel` — one mana, its own tap and an untapped creature I
// control tapped (the D286 tap chooser) make a 1/1 green Saproling.

import { SELESNYA_EVANGEL } from '../../../data/fixtures/engineCards';
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
  SELESNYA_EVANGEL,
  '{1}, {T}, Tap an untapped creature you control: Create a 1/1 green Saproling creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}
const SAPROLING = tokenRef('Saproling|1/1|G|Creature|');

export const SELESNYA_EVANGEL_SCRIPT: CardScript = {
  oracleId: SELESNYA_EVANGEL.oracleId,
  name: SELESNYA_EVANGEL.name,
  activated: [
    {
      ref: `${SELESNYA_EVANGEL.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SAPROLING.oracleId,
          printingId: SAPROLING.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
