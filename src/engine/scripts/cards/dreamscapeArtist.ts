// `Dreamscape Artist` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DREAMSCAPE_ARTIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DREAMSCAPE_ARTIST, "{2}{U}, {T}, Discard a card, Sacrifice a land: Search your library for up to two basic land cards, put them onto the battlefield, then shuffle.");

const VOCAB_A0 = vocabularyEffects("Search your library for up to two basic land cards, put them onto the battlefield, then shuffle.", DREAMSCAPE_ARTIST.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for up to two basic land cards, put them onto the battlefield, then shuffle.");

export const DREAMSCAPE_ARTIST_SCRIPT: CardScript = {
  oracleId: DREAMSCAPE_ARTIST.oracleId,
  name: DREAMSCAPE_ARTIST.name,
  activated: [
    {
      ref: `${DREAMSCAPE_ARTIST.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
