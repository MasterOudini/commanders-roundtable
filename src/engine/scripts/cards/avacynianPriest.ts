// `Avacynian Priest` - tap on "Tap target non-Human creature": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { AVACYNIAN_PRIEST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVACYNIAN_PRIEST, "{1}, {T}: Tap target non-Human creature.");
const TEXT = PRINTED;

export const AVACYNIAN_PRIEST_SCRIPT: CardScript = {
  oracleId: AVACYNIAN_PRIEST.oracleId,
  name: AVACYNIAN_PRIEST.name,
  activated: [
    {
      ref: `${AVACYNIAN_PRIEST.oracleId}#a0`,
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
