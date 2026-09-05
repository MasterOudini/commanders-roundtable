// `Morphling` - an activation untapSelf, an activation pumping itself, an activation pumping itself, an activation pumping itself, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MORPHLING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MORPHLING, "{U}: Untap this creature.\n{U}: This creature gains flying until end of turn.\n{U}: This creature gains shroud until end of turn. (It can't be the target of spells or abilities.)\n{1}: This creature gets +1/-1 until end of turn.\n{1}: This creature gets -1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const MORPHLING_SCRIPT: CardScript = {
  oracleId: MORPHLING.oracleId,
  name: MORPHLING.name,
  activated: [
    {
      ref: `${MORPHLING.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
    {
      ref: `${MORPHLING.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["flying"] }];
      },
    },
    {
      ref: `${MORPHLING.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["shroud"] }];
      },
    },
    {
      ref: `${MORPHLING.oracleId}#a3`,
      text: LINES[3] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: -1 }];
      },
    },
    {
      ref: `${MORPHLING.oracleId}#a4`,
      text: LINES[4] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: -1, toughness: 1 }];
      },
    },
  ],
};
