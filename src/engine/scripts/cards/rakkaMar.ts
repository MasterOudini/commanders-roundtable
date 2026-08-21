// `Rakka Mar` — "{R}, {T}: Create a 3/1 red Elemental creature token
// with haste." The repeatable token maker on a legend; the Haste line is
// the engine's. D237.

import { RAKKA_MAR } from '../../../data/fixtures/engineCards';
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
  RAKKA_MAR,
  'Haste\n{R}, {T}: Create a 3/1 red Elemental creature token with haste.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const ELEMENTAL = tokenRef('Elemental|3/1|R|Creature|haste');

export const RAKKA_MAR_SCRIPT: CardScript = {
  oracleId: RAKKA_MAR.oracleId,
  name: RAKKA_MAR.name,
  activated: [
    {
      ref: `${RAKKA_MAR.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: ELEMENTAL.oracleId,
          printingId: ELEMENTAL.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
