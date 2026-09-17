// `Safewright Cavalry` - a static maxBlockers, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAFEWRIGHT_CAVALRY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAFEWRIGHT_CAVALRY, "This creature can't be blocked by more than one creature.\n{5}: Target Elf you control gets +2/+2 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target Elf you control gets +2/+2 until end of turn.", SAFEWRIGHT_CAVALRY.name);
const VOCAB_T_A0 = vocabularyTargets("Target Elf you control gets +2/+2 until end of turn.");

export const SAFEWRIGHT_CAVALRY_SCRIPT: CardScript = {
  oracleId: SAFEWRIGHT_CAVALRY.oracleId,
  name: SAFEWRIGHT_CAVALRY.name,
  activated: [
    {
      ref: `${SAFEWRIGHT_CAVALRY.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  combat: [
    {
      abilityId: 'maxBlockers-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      maxBlockers: (_ctx, self, attacker) => (attacker === self ? 1 : null),
    },
  ],
};
