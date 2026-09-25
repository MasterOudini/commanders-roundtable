// `Proud Mentor` - an activation tapTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PROUD_MENTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PROUD_MENTOR, "Partner with Impetuous Protege (When this creature enters, target player may put Impetuous Protege into their hand from their library, then shuffle.)\n{W}, {T}: Tap target creature.");
const LINES = PRINTED.split('\n');

export const PROUD_MENTOR_SCRIPT: CardScript = {
  oracleId: PROUD_MENTOR.oracleId,
  name: PROUD_MENTOR.name,
  activated: [
    {
      ref: `${PROUD_MENTOR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
