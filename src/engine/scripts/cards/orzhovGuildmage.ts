// `Orzhov Guildmage` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORZHOV_GUILDMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORZHOV_GUILDMAGE, "{2}{W}: Target player gains 1 life.\n{2}{B}: Each player loses 1 life.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player gains 1 life.", ORZHOV_GUILDMAGE.name);
const VOCAB_T_A0 = vocabularyTargets("Target player gains 1 life.");
const VOCAB_A1 = vocabularyEffects("Each player loses 1 life.", ORZHOV_GUILDMAGE.name);
const VOCAB_T_A1 = vocabularyTargets("Each player loses 1 life.");

export const ORZHOV_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: ORZHOV_GUILDMAGE.oracleId,
  name: ORZHOV_GUILDMAGE.name,
  activated: [
    {
      ref: `${ORZHOV_GUILDMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${ORZHOV_GUILDMAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
