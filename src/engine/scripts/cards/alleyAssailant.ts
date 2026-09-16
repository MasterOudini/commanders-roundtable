// `Alley Assailant` - a turnedFaceUp trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ALLEY_ASSAILANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ALLEY_ASSAILANT, "This creature enters tapped.\nDisguise {4}{B}{B} (You may cast this card face down for {3} as a 2/2 creature with ward {2}. Turn it face up any time for its disguise cost.)\nWhen this creature is turned face up, target opponent loses 3 life and you gain 3 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Target opponent loses 3 life and you gain 3 life.", ALLEY_ASSAILANT.name);
const VOCAB_T_L2 = vocabularyTargets("Target opponent loses 3 life and you gain 3 life.");

export const ALLEY_ASSAILANT_SCRIPT: CardScript = {
  oracleId: ALLEY_ASSAILANT.oracleId,
  name: ALLEY_ASSAILANT.name,
  triggers: [
    {
      abilityId: 'turnedFaceUp-2',
      text: LINES[2] as string,
      event: 'FaceDownSet',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) => ev.t === 'FaceDownSet' && ev.card === self && !ev.faceDown,
      label: () => "Alley Assailant - Target opponent loses 3 life and you gain 3 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
