// `Blinkmoth Well` - tap on "Tap target noncreature artifact": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { BLINKMOTH_WELL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLINKMOTH_WELL, "{T}: Add {C}.\n{2}, {T}: Tap target noncreature artifact.");
const TEXT = PRINTED.split('\n')[1] as string;

export const BLINKMOTH_WELL_SCRIPT: CardScript = {
  oracleId: BLINKMOTH_WELL.oracleId,
  name: BLINKMOTH_WELL.name,
  activated: [
    {
      ref: `${BLINKMOTH_WELL.oracleId}#a1`,
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
