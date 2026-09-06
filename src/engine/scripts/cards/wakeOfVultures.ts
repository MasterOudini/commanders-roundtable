// `Wake of Vultures` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WAKE_OF_VULTURES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WAKE_OF_VULTURES, "Flying\n{1}{B}, Sacrifice a creature: Regenerate this creature.");
const LINES = PRINTED.split('\n');

export const WAKE_OF_VULTURES_SCRIPT: CardScript = {
  oracleId: WAKE_OF_VULTURES.oracleId,
  name: WAKE_OF_VULTURES.name,
  activated: [
    {
      ref: `${WAKE_OF_VULTURES.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
