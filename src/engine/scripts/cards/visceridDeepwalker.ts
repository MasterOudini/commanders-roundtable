// `Viscerid Deepwalker` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VISCERID_DEEPWALKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VISCERID_DEEPWALKER, "{U}: This creature gets +1/+0 until end of turn.\nSuspend 4—{U} (Rather than cast this card from your hand, you may pay {U} and exile it with four time counters on it. At the beginning of your upkeep, remove a time counter. When the last is removed, you may cast it without paying its mana cost. It has haste.)");
const LINES = PRINTED.split('\n');

export const VISCERID_DEEPWALKER_SCRIPT: CardScript = {
  oracleId: VISCERID_DEEPWALKER.oracleId,
  name: VISCERID_DEEPWALKER.name,
  activated: [
    {
      ref: `${VISCERID_DEEPWALKER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
