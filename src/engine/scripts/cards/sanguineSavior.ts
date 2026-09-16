// `Sanguine Savior` - a turnedFaceUp trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SANGUINE_SAVIOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SANGUINE_SAVIOR, "Flying, lifelink\nDisguise {W/B}{W/B} (You may cast this card face down for {3} as a 2/2 creature with ward {2}. Turn it face up any time for its disguise cost.)\nWhen this creature is turned face up, another target creature you control gains lifelink until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Another target creature you control gains lifelink until end of turn.", SANGUINE_SAVIOR.name);
const VOCAB_T_L2 = vocabularyTargets("Another target creature you control gains lifelink until end of turn.");

export const SANGUINE_SAVIOR_SCRIPT: CardScript = {
  oracleId: SANGUINE_SAVIOR.oracleId,
  name: SANGUINE_SAVIOR.name,
  triggers: [
    {
      abilityId: 'turnedFaceUp-2',
      text: LINES[2] as string,
      event: 'FaceDownSet',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) => ev.t === 'FaceDownSet' && ev.card === self && !ev.faceDown,
      label: () => "Sanguine Savior - Another target creature you control gains lifelink until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
