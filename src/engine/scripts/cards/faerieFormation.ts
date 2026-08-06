// `Faerie Formation` — "Flying\n{3}{U}: Create a 1/1 blue Faerie creature
// token with flying. Draw a card." TWO effects in one resolve — the token
// and the draw arrive together, which is exactly what returning both events
// means. M6.4r, D174.

import { FAERIE_FORMATION } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(
  FAERIE_FORMATION,
  'Flying\n{3}{U}: Create a 1/1 blue Faerie creature token with flying. Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const FAERIE = tokenRef('Faerie|1/1|U|Creature|flying');

export const FAERIE_FORMATION_SCRIPT: CardScript = {
  oracleId: FAERIE_FORMATION.oracleId,
  name: FAERIE_FORMATION.name,
  activated: [
    {
      ref: `${FAERIE_FORMATION.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: FAERIE.oracleId,
          printingId: FAERIE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
        ...drawEvents(ctx.state, obj.controller, 1),
      ],
    },
  ],
};
