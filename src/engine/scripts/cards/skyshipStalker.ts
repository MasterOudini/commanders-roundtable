// `Skyship Stalker` - a one-shot pump on itself / itself / itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { SKYSHIP_STALKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKYSHIP_STALKER, "Flying\n{R}: This creature gets +1/+0 until end of turn.\n{R}: This creature gains first strike until end of turn.\n{R}: This creature gains haste until end of turn.");
const LINES = PRINTED.split('\n');

export const SKYSHIP_STALKER_SCRIPT: CardScript = {
  oracleId: SKYSHIP_STALKER.oracleId,
  name: SKYSHIP_STALKER.name,
  activated: [
    {
      ref: `${SKYSHIP_STALKER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
    {
      ref: `${SKYSHIP_STALKER.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["firstStrike"] }];
      },
    },
    {
      ref: `${SKYSHIP_STALKER.oracleId}#a2`,
      text: LINES[3] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["haste"] }];
      },
    },
  ],
};
