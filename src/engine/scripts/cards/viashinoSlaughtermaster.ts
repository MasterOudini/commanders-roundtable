// `Viashino Slaughtermaster` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIASHINO_SLAUGHTERMASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIASHINO_SLAUGHTERMASTER, "Double strike\n{B}{G}: This creature gets +1/+1 until end of turn. Activate only once each turn.");
const LINES = PRINTED.split('\n');

export const VIASHINO_SLAUGHTERMASTER_SCRIPT: CardScript = {
  oracleId: VIASHINO_SLAUGHTERMASTER.oracleId,
  name: VIASHINO_SLAUGHTERMASTER.name,
  activated: [
    {
      ref: `${VIASHINO_SLAUGHTERMASTER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
