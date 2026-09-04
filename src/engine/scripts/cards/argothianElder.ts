// `Argothian Elder` - untap on "Untap two target lands", once per pick: the count and the
// noun are the parser's and the validator's (D299). Generated from one table row.

import { ARGOTHIAN_ELDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARGOTHIAN_ELDER, "{T}: Untap two target lands.");
const TEXT = PRINTED;

export const ARGOTHIAN_ELDER_SCRIPT: CardScript = {
  oracleId: ARGOTHIAN_ELDER.oracleId,
  name: ARGOTHIAN_ELDER.name,
  activated: [
    {
      ref: `${ARGOTHIAN_ELDER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick - the count is the parser's and the validator's.
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') continue;
          if (card.tapped) out.push({ t: 'PermanentsUntapped', cards: [target.id] });
        }
        return out;
      },
    },
  ],
};
