// `Krark-Clan Grunt` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KRARK_CLAN_GRUNT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KRARK_CLAN_GRUNT, "Sacrifice an artifact: This creature gets +1/+0 and gains first strike until end of turn.");

export const KRARK_CLAN_GRUNT_SCRIPT: CardScript = {
  oracleId: KRARK_CLAN_GRUNT.oracleId,
  name: KRARK_CLAN_GRUNT.name,
  activated: [
    {
      ref: `${KRARK_CLAN_GRUNT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0, keywords: ["firstStrike"] }];
      },
    },
  ],
};
