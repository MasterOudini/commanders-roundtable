// `Darkling Stalker` - an activation regenerate, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DARKLING_STALKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DARKLING_STALKER, "{B}: Regenerate this creature.\n{B}: This creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const DARKLING_STALKER_SCRIPT: CardScript = {
  oracleId: DARKLING_STALKER.oracleId,
  name: DARKLING_STALKER.name,
  activated: [
    {
      ref: `${DARKLING_STALKER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
    {
      ref: `${DARKLING_STALKER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
