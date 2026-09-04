// `Searing Spear Askari` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEARING_SPEAR_ASKARI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEARING_SPEAR_ASKARI, "Flanking (Whenever a creature without flanking blocks this creature, the blocking creature gets -1/-1 until end of turn.)\n{1}{R}: This creature gains menace until end of turn. (It can't be blocked except by two or more creatures.)");
const LINES = PRINTED.split('\n');

export const SEARING_SPEAR_ASKARI_SCRIPT: CardScript = {
  oracleId: SEARING_SPEAR_ASKARI.oracleId,
  name: SEARING_SPEAR_ASKARI.name,
  activated: [
    {
      ref: `${SEARING_SPEAR_ASKARI.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["menace"] }];
      },
    },
  ],
};
