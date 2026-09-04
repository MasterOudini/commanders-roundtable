// `Relentless Hunter` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { RELENTLESS_HUNTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RELENTLESS_HUNTER, "{1}{R}{G}: This creature gets +1/+1 and gains trample until end of turn.");

export const RELENTLESS_HUNTER_SCRIPT: CardScript = {
  oracleId: RELENTLESS_HUNTER.oracleId,
  name: RELENTLESS_HUNTER.name,
  activated: [
    {
      ref: `${RELENTLESS_HUNTER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1, keywords: ["trample"] }];
      },
    },
  ],
};
