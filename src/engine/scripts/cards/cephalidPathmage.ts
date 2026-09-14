// `Cephalid Pathmage` - a static cantBeBlocked, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CEPHALID_PATHMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CEPHALID_PATHMAGE, "This creature can't be blocked.\n{T}, Sacrifice this creature: Target creature can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature can't be blocked this turn.", CEPHALID_PATHMAGE.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't be blocked this turn.");

export const CEPHALID_PATHMAGE_SCRIPT: CardScript = {
  oracleId: CEPHALID_PATHMAGE.oracleId,
  name: CEPHALID_PATHMAGE.name,
  activated: [
    {
      ref: `${CEPHALID_PATHMAGE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBeBlocked-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, _blocker, attacker) => attacker !== self,
    },
  ],
};
