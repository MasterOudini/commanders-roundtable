// `Camera Launcher` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAMERA_LAUNCHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CAMERA_LAUNCHER, "Exhaust — {3}: Put a +1/+1 counter on this creature. Create a 1/1 colorless Thopter artifact creature token with flying. (Activate each exhaust ability only once.)");

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on this creature. Create a 1/1 colorless Thopter artifact creature token with flying.", CAMERA_LAUNCHER.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on this creature. Create a 1/1 colorless Thopter artifact creature token with flying.");

export const CAMERA_LAUNCHER_SCRIPT: CardScript = {
  oracleId: CAMERA_LAUNCHER.oracleId,
  name: CAMERA_LAUNCHER.name,
  activated: [
    {
      ref: `${CAMERA_LAUNCHER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
