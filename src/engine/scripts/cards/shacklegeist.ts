// `Shacklegeist` - a static blocksOnlyFlying, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHACKLEGEIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHACKLEGEIST, "Flying\nThis creature can block only creatures with flying.\nTap two untapped Spirits you control: Tap target creature you don't control.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Tap target creature you don't control.", SHACKLEGEIST.name);
const VOCAB_T_A0 = vocabularyTargets("Tap target creature you don't control.");

export const SHACKLEGEIST_SCRIPT: CardScript = {
  oracleId: SHACKLEGEIST.oracleId,
  name: SHACKLEGEIST.name,
  activated: [
    {
      ref: `${SHACKLEGEIST.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  combat: [
    {
      abilityId: 'blocksOnlyFlying-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => blocker !== self || ctx.derive(attacker).keywords.has('flying'),
    },
  ],
};
