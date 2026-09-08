// `Planar Portal` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PLANAR_PORTAL } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(PLANAR_PORTAL, "{6}, {T}: Search your library for a card, put that card into your hand, then shuffle.");

const VOCAB_A0 = vocabularyEffects("Search your library for a card, put that card into your hand, then shuffle.", PLANAR_PORTAL.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a card, put that card into your hand, then shuffle.");

export const PLANAR_PORTAL_SCRIPT: CardScript = {
  oracleId: PLANAR_PORTAL.oracleId,
  name: PLANAR_PORTAL.name,
  activated: [
    {
      ref: `${PLANAR_PORTAL.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
