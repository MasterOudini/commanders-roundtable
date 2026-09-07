// `Krark-Clan Engineers` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KRARK_CLAN_ENGINEERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KRARK_CLAN_ENGINEERS, "{R}, Sacrifice two artifacts: Destroy target artifact.");

const VOCAB_A0 = vocabularyEffects("Destroy target artifact.", KRARK_CLAN_ENGINEERS.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target artifact.");

export const KRARK_CLAN_ENGINEERS_SCRIPT: CardScript = {
  oracleId: KRARK_CLAN_ENGINEERS.oracleId,
  name: KRARK_CLAN_ENGINEERS.name,
  activated: [
    {
      ref: `${KRARK_CLAN_ENGINEERS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
