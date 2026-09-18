// `Icehide Troll` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ICEHIDE_TROLL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ICEHIDE_TROLL, "{S}{S}: This creature gets +2/+0 and gains indestructible until end of turn. Tap it. (Damage and effects that say \"destroy\" don't destroy it. {S} can be paid with one mana from a snow source.)");

const VOCAB_A0 = vocabularyEffects("~ gets +2/+0 and gains indestructible until end of turn. Tap it.", ICEHIDE_TROLL.name);
const VOCAB_T_A0 = vocabularyTargets("~ gets +2/+0 and gains indestructible until end of turn. Tap it.");

export const ICEHIDE_TROLL_SCRIPT: CardScript = {
  oracleId: ICEHIDE_TROLL.oracleId,
  name: ICEHIDE_TROLL.name,
  activated: [
    {
      ref: `${ICEHIDE_TROLL.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
