// `Captivating Crew` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAPTIVATING_CREW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CAPTIVATING_CREW, "{3}{R}: Gain control of target creature an opponent controls until end of turn. Untap that creature. It gains haste until end of turn. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Gain control of target creature an opponent controls until end of turn. Untap that creature. It gains haste until end of turn.", CAPTIVATING_CREW.name);
const VOCAB_T_A0 = vocabularyTargets("Gain control of target creature an opponent controls until end of turn. Untap that creature. It gains haste until end of turn.");

export const CAPTIVATING_CREW_SCRIPT: CardScript = {
  oracleId: CAPTIVATING_CREW.oracleId,
  name: CAPTIVATING_CREW.name,
  activated: [
    {
      ref: `${CAPTIVATING_CREW.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
