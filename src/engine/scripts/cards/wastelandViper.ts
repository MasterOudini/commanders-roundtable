// `Wasteland Viper` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WASTELAND_VIPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WASTELAND_VIPER, "Deathtouch\nBloodrush — {G}, Discard this card: Target attacking creature gets +1/+2 and gains deathtouch until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target attacking creature gets +1/+2 and gains deathtouch until end of turn.", WASTELAND_VIPER.name);
const VOCAB_T_A0 = vocabularyTargets("Target attacking creature gets +1/+2 and gains deathtouch until end of turn.");

export const WASTELAND_VIPER_SCRIPT: CardScript = {
  oracleId: WASTELAND_VIPER.oracleId,
  name: WASTELAND_VIPER.name,
  activated: [
    {
      ref: `${WASTELAND_VIPER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
