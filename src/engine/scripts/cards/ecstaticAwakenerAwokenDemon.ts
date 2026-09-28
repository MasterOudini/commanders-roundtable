// `Ecstatic Awakener // Awoken Demon` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ECSTATIC_AWAKENER_AWOKEN_DEMON } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(ECSTATIC_AWAKENER_AWOKEN_DEMON, "{2}{B}, Sacrifice another creature: Draw a card, then transform this creature. Activate only once each turn.\n");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Draw a card, then transform this creature.", ECSTATIC_AWAKENER_AWOKEN_DEMON.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Draw a card, then transform this creature.");

export const ECSTATIC_AWAKENER_AWOKEN_DEMON_SCRIPT: CardScript = {
  oracleId: ECSTATIC_AWAKENER_AWOKEN_DEMON.oracleId,
  name: ECSTATIC_AWAKENER_AWOKEN_DEMON.name,
  activated: [
    {
      ref: `${ECSTATIC_AWAKENER_AWOKEN_DEMON.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
