// `Hell Mongrel` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HELL_MONGREL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HELL_MONGREL, "Discard a card: This creature gets +1/+1 until end of turn.\nMadness {2}{B} (If you discard this card, discard it into exile. When you do, cast it for its madness cost or put it into your graveyard.)");
const LINES = PRINTED.split('\n');

export const HELL_MONGREL_SCRIPT: CardScript = {
  oracleId: HELL_MONGREL.oracleId,
  name: HELL_MONGREL.name,
  activated: [
    {
      ref: `${HELL_MONGREL.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
