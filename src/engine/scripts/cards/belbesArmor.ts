// `Belbe's Armor` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BELBE_S_ARMOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BELBE_S_ARMOR, "{X}, {T}: Target creature gets -X/+X until end of turn.");

const VOCAB_A0 = vocabularyEffects("Target creature gets -X/+X until end of turn.", BELBE_S_ARMOR.name, { xCost: true });
const VOCAB_T_A0 = vocabularyTargets("Target creature gets -X/+X until end of turn.");

export const BELBES_ARMOR_SCRIPT: CardScript = {
  oracleId: BELBE_S_ARMOR.oracleId,
  name: BELBE_S_ARMOR.name,
  activated: [
    {
      ref: `${BELBE_S_ARMOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
