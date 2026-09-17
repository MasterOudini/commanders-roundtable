// `Olivia's Bloodsworn` - a static cantBlock, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OLIVIA_S_BLOODSWORN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OLIVIA_S_BLOODSWORN, "Flying\nThis creature can't block.\n{R}: Target Vampire gains haste until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target Vampire gains haste until end of turn.", OLIVIA_S_BLOODSWORN.name);
const VOCAB_T_A0 = vocabularyTargets("Target Vampire gains haste until end of turn.");

export const OLIVIAS_BLOODSWORN_SCRIPT: CardScript = {
  oracleId: OLIVIA_S_BLOODSWORN.oracleId,
  name: OLIVIA_S_BLOODSWORN.name,
  activated: [
    {
      ref: `${OLIVIA_S_BLOODSWORN.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBlock-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
