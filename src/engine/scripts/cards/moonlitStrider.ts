// `Moonlit Strider` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOONLIT_STRIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOONLIT_STRIDER, "Sacrifice this creature: Target creature you control gains protection from the color of your choice until end of turn.\nSoulshift 3 (When this creature dies, you may return target Spirit card with mana value 3 or less from your graveyard to your hand.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature you control gains protection from the color of your choice until end of turn.", MOONLIT_STRIDER.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature you control gains protection from the color of your choice until end of turn.");

export const MOONLIT_STRIDER_SCRIPT: CardScript = {
  oracleId: MOONLIT_STRIDER.oracleId,
  name: MOONLIT_STRIDER.name,
  activated: [
    {
      ref: `${MOONLIT_STRIDER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
