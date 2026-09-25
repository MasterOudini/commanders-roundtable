// `Yasmin Khan` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { YASMIN_KHAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(YASMIN_KHAN, "{T}: Exile the top card of your library. Until your next end step, you may play it.\nDoctor's companion (You can have two commanders if the other is the Doctor.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Exile the top card of your library. Until your next end step, you may play it.", YASMIN_KHAN.name);
const VOCAB_T_A0 = vocabularyTargets("Exile the top card of your library. Until your next end step, you may play it.");

export const YASMIN_KHAN_SCRIPT: CardScript = {
  oracleId: YASMIN_KHAN.oracleId,
  name: YASMIN_KHAN.name,
  activated: [
    {
      ref: `${YASMIN_KHAN.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
