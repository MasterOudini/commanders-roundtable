// `Carnivorous Moss-Beast` - an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CARNIVOROUS_MOSS_BEAST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CARNIVOROUS_MOSS_BEAST, "{5}{G}{G}: Put a +1/+1 counter on this creature.");

export const CARNIVOROUS_MOSS_BEAST_SCRIPT: CardScript = {
  oracleId: CARNIVOROUS_MOSS_BEAST.oracleId,
  name: CARNIVOROUS_MOSS_BEAST.name,
  activated: [
    {
      ref: `${CARNIVOROUS_MOSS_BEAST.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
