// `Thornling` - a one-shot pump on itself / itself / itself / itself / itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { THORNLING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THORNLING, "{G}: This creature gains haste until end of turn.\n{G}: This creature gains trample until end of turn.\n{G}: This creature gains indestructible until end of turn.\n{1}: This creature gets +1/-1 until end of turn.\n{1}: This creature gets -1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const THORNLING_SCRIPT: CardScript = {
  oracleId: THORNLING.oracleId,
  name: THORNLING.name,
  activated: [
    {
      ref: `${THORNLING.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["haste"] }];
      },
    },
    {
      ref: `${THORNLING.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["trample"] }];
      },
    },
    {
      ref: `${THORNLING.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["indestructible"] }];
      },
    },
    {
      ref: `${THORNLING.oracleId}#a3`,
      text: LINES[3] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: -1 }];
      },
    },
    {
      ref: `${THORNLING.oracleId}#a4`,
      text: LINES[4] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: -1, toughness: 1 }];
      },
    },
  ],
};
