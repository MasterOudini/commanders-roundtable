// `Aven Liberator` - a turnedFaceUp trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AVEN_LIBERATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVEN_LIBERATOR, "Flying\nMorph {3}{W} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)\nWhen this creature is turned face up, target creature you control gains protection from the color of your choice until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Target creature you control gains protection from the color of your choice until end of turn.", AVEN_LIBERATOR.name);
const VOCAB_T_L2 = vocabularyTargets("Target creature you control gains protection from the color of your choice until end of turn.");

export const AVEN_LIBERATOR_SCRIPT: CardScript = {
  oracleId: AVEN_LIBERATOR.oracleId,
  name: AVEN_LIBERATOR.name,
  triggers: [
    {
      abilityId: 'turnedFaceUp-2',
      text: LINES[2] as string,
      event: 'FaceDownSet',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) => ev.t === 'FaceDownSet' && ev.card === self && !ev.faceDown,
      label: () => "Aven Liberator - Target creature you control gains protection from the color of your choice until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
