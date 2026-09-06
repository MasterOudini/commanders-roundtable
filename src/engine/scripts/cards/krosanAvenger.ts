// `Krosan Avenger` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KROSAN_AVENGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KROSAN_AVENGER, "Trample\nThreshold — {1}{G}: Regenerate this creature. Activate only if there are seven or more cards in your graveyard.");
const LINES = PRINTED.split('\n');

export const KROSAN_AVENGER_SCRIPT: CardScript = {
  oracleId: KROSAN_AVENGER.oracleId,
  name: KROSAN_AVENGER.name,
  activated: [
    {
      ref: `${KROSAN_AVENGER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
