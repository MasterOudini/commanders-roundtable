// `Maelstrom of the Spirit Dragon` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAELSTROM_OF_THE_SPIRIT_DRAGON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAELSTROM_OF_THE_SPIRIT_DRAGON, "{T}: Add {C}.\n{T}: Add one mana of any color. Spend this mana only to cast a Dragon spell or an Omen spell.\n{4}, {T}, Sacrifice this land: Search your library for a Dragon card, reveal it, put it into your hand, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A2 = vocabularyEffects("Search your library for a Dragon card, reveal it, put it into your hand, then shuffle.", MAELSTROM_OF_THE_SPIRIT_DRAGON.name);
const VOCAB_T_A2 = vocabularyTargets("Search your library for a Dragon card, reveal it, put it into your hand, then shuffle.");

export const MAELSTROM_OF_THE_SPIRIT_DRAGON_SCRIPT: CardScript = {
  oracleId: MAELSTROM_OF_THE_SPIRIT_DRAGON.oracleId,
  name: MAELSTROM_OF_THE_SPIRIT_DRAGON.name,
  activated: [
    {
      ref: `${MAELSTROM_OF_THE_SPIRIT_DRAGON.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
