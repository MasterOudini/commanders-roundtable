// `Skittering Heartstopper` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { SKITTERING_HEARTSTOPPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKITTERING_HEARTSTOPPER, "{B}: This creature gains deathtouch until end of turn.");

export const SKITTERING_HEARTSTOPPER_SCRIPT: CardScript = {
  oracleId: SKITTERING_HEARTSTOPPER.oracleId,
  name: SKITTERING_HEARTSTOPPER.name,
  activated: [
    {
      ref: `${SKITTERING_HEARTSTOPPER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["deathtouch"] }];
      },
    },
  ],
};
