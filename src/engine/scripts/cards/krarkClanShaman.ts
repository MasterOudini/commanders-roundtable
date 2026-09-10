// `Krark-Clan Shaman` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KRARK_CLAN_SHAMAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KRARK_CLAN_SHAMAN, "Sacrifice an artifact: This creature deals 1 damage to each creature without flying.");

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to each creature without flying.", KRARK_CLAN_SHAMAN.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to each creature without flying.");

export const KRARK_CLAN_SHAMAN_SCRIPT: CardScript = {
  oracleId: KRARK_CLAN_SHAMAN.oracleId,
  name: KRARK_CLAN_SHAMAN.name,
  activated: [
    {
      ref: `${KRARK_CLAN_SHAMAN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
