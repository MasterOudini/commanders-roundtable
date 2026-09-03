// `Ring of the Lucii` - tap on "Tap target nonland permanent": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { RING_OF_THE_LUCII } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RING_OF_THE_LUCII, "{T}: Add {C}{C}.\n{2}, {T}, Pay 1 life: Tap target nonland permanent.");
const TEXT = PRINTED.split('\n')[1] as string;

export const RING_OF_THE_LUCII_SCRIPT: CardScript = {
  oracleId: RING_OF_THE_LUCII.oracleId,
  name: RING_OF_THE_LUCII.name,
  activated: [
    {
      ref: `${RING_OF_THE_LUCII.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        if (card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
