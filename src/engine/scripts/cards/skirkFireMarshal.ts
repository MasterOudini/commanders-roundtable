// `Skirk Fire Marshal` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKIRK_FIRE_MARSHAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKIRK_FIRE_MARSHAL, "Protection from red\nTap five untapped Goblins you control: This creature deals 10 damage to each creature and each player.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals 10 damage to each creature and each player.", SKIRK_FIRE_MARSHAL.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 10 damage to each creature and each player.");

export const SKIRK_FIRE_MARSHAL_SCRIPT: CardScript = {
  oracleId: SKIRK_FIRE_MARSHAL.oracleId,
  name: SKIRK_FIRE_MARSHAL.name,
  activated: [
    {
      ref: `${SKIRK_FIRE_MARSHAL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
