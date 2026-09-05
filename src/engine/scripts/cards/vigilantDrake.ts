// `Vigilant Drake` - an activation untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIGILANT_DRAKE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIGILANT_DRAKE, "Flying\n{2}{U}: Untap this creature.");
const LINES = PRINTED.split('\n');

export const VIGILANT_DRAKE_SCRIPT: CardScript = {
  oracleId: VIGILANT_DRAKE.oracleId,
  name: VIGILANT_DRAKE.name,
  activated: [
    {
      ref: `${VIGILANT_DRAKE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
};
