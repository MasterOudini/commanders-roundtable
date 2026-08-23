// `Vitu-Ghazi, the City-Tree` — Land, "{T}: Add {C}.\n{2}{G}{W}, {T}: Create
// a 1/1 green Saproling creature token." Foundry of the Consuls' shape (D175)
// without the sacrifice: the mana line is ability 0, the Saproling is `#a1`.
// M6.4dc, D266.

import { VITU_GHAZI_THE_CITY_TREE } from '../../../data/fixtures/engineCards';
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
  VITU_GHAZI_THE_CITY_TREE,
  '{T}: Add {C}.\n{2}{G}{W}, {T}: Create a 1/1 green Saproling creature token.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SAPROLING = tokenRef('Saproling|1/1|G|Creature|');

export const VITU_GHAZI_THE_CITY_TREE_SCRIPT: CardScript = {
  oracleId: VITU_GHAZI_THE_CITY_TREE.oracleId,
  name: VITU_GHAZI_THE_CITY_TREE.name,
  activated: [
    {
      // `#a1`: a mana line COUNTS as an ability, so the Saproling is index 1.
      ref: `${VITU_GHAZI_THE_CITY_TREE.oracleId}#a1`,
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
