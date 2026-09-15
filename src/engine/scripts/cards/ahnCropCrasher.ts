// `Ahn-Crop Crasher` - a exertAttack trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AHN_CROP_CRASHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AHN_CROP_CRASHER, "Haste (This creature can attack and {T} as soon as it comes under your control.)\nYou may exert this creature as it attacks. When you do, target creature can't block this turn. (An exerted creature won't untap during your next untap step.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature can't block this turn.", AHN_CROP_CRASHER.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature can't block this turn.");

export const AHN_CROP_CRASHER_SCRIPT: CardScript = {
  oracleId: AHN_CROP_CRASHER.oracleId,
  name: AHN_CROP_CRASHER.name,
  triggers: [
    {
      abilityId: 'exertAttack-1',
      text: LINES[1] as string,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'Exerted' && ev.card === self,
      label: () => "Ahn-Crop Crasher - Target creature can't block this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
