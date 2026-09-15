// `Henchfiend of Ukor` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HENCHFIEND_OF_UKOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HENCHFIEND_OF_UKOR, "Haste\nEcho {1}{B} (At the beginning of your upkeep, if this came under your control since the beginning of your last upkeep, sacrifice it unless you pay its echo cost.)\n{B/R}: This creature gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const HENCHFIEND_OF_UKOR_SCRIPT: CardScript = {
  oracleId: HENCHFIEND_OF_UKOR.oracleId,
  name: HENCHFIEND_OF_UKOR.name,
  activated: [
    {
      ref: `${HENCHFIEND_OF_UKOR.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
