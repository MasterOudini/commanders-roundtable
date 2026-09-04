// `Fetid Imp` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { FETID_IMP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FETID_IMP, "Flying\n{B}: This creature gains deathtouch until end of turn. (Any amount of damage it deals to a creature is enough to destroy it.)");
const LINES = PRINTED.split('\n');

export const FETID_IMP_SCRIPT: CardScript = {
  oracleId: FETID_IMP.oracleId,
  name: FETID_IMP.name,
  activated: [
    {
      ref: `${FETID_IMP.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["deathtouch"] }];
      },
    },
  ],
};
