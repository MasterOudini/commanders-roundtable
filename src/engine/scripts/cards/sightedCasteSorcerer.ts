// `Sighted-Caste Sorcerer` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIGHTED_CASTE_SORCERER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIGHTED_CASTE_SORCERER, "Exalted (Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn.)\n{U}: This creature gains shroud until end of turn. (It can't be the target of spells or abilities.)");
const LINES = PRINTED.split('\n');

export const SIGHTED_CASTE_SORCERER_SCRIPT: CardScript = {
  oracleId: SIGHTED_CASTE_SORCERER.oracleId,
  name: SIGHTED_CASTE_SORCERER.name,
  activated: [
    {
      ref: `${SIGHTED_CASTE_SORCERER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["shroud"] }];
      },
    },
  ],
};
