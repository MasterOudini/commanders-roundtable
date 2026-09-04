// `Songbird, Sonic Screamer` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SONGBIRD_SONIC_SCREAMER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SONGBIRD_SONIC_SCREAMER, "Lifelink (Damage dealt by this creature also causes you to gain that much life.)\nDiscard a card: Songbird gains flying until end of turn. (She can't be blocked except by creatures with flying or reach.)");
const LINES = PRINTED.split('\n');

export const SONGBIRD_SONIC_SCREAMER_SCRIPT: CardScript = {
  oracleId: SONGBIRD_SONIC_SCREAMER.oracleId,
  name: SONGBIRD_SONIC_SCREAMER.name,
  activated: [
    {
      ref: `${SONGBIRD_SONIC_SCREAMER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["flying"] }];
      },
    },
  ],
};
