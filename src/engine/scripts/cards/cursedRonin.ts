// `Cursed Ronin` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CURSED_RONIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CURSED_RONIN, "Bushido 1 (Whenever this creature blocks or becomes blocked, it gets +1/+1 until end of turn.)\n{B}: This creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const CURSED_RONIN_SCRIPT: CardScript = {
  oracleId: CURSED_RONIN.oracleId,
  name: CURSED_RONIN.name,
  activated: [
    {
      ref: `${CURSED_RONIN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
