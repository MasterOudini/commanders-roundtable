// `Undead Leotau` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNDEAD_LEOTAU } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNDEAD_LEOTAU, "{R}: This creature gets +1/-1 until end of turn.\nUnearth {2}{B} ({2}{B}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step or if it would leave the battlefield. Unearth only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const UNDEAD_LEOTAU_SCRIPT: CardScript = {
  oracleId: UNDEAD_LEOTAU.oracleId,
  name: UNDEAD_LEOTAU.name,
  activated: [
    {
      ref: `${UNDEAD_LEOTAU.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: -1 }];
      },
    },
  ],
};
