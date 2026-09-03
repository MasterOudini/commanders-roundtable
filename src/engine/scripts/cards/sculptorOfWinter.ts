// `Sculptor of Winter` - untap on "Untap target snow land": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { SCULPTOR_OF_WINTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCULPTOR_OF_WINTER, "{T}: Untap target snow land.");
const TEXT = PRINTED;

export const SCULPTOR_OF_WINTER_SCRIPT: CardScript = {
  oracleId: SCULPTOR_OF_WINTER.oracleId,
  name: SCULPTOR_OF_WINTER.name,
  activated: [
    {
      ref: `${SCULPTOR_OF_WINTER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        if (!card.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [target.id] }];
      },
    },
  ],
};
