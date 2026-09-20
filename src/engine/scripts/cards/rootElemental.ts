// `Root Elemental` - a turnedFaceUp trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROOT_ELEMENTAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROOT_ELEMENTAL, "Morph {5}{G}{G} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)\nWhen this creature is turned face up, you may put a creature card from your hand onto the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a creature card from your hand onto the battlefield.", ROOT_ELEMENTAL.name);
const VOCAB_T_L1 = vocabularyTargets("Put a creature card from your hand onto the battlefield.");

export const ROOT_ELEMENTAL_SCRIPT: CardScript = {
  oracleId: ROOT_ELEMENTAL.oracleId,
  name: ROOT_ELEMENTAL.name,
  triggers: [
    {
      abilityId: 'turnedFaceUp-1',
      text: LINES[1] as string,
      event: 'FaceDownSet',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) => ev.t === 'FaceDownSet' && ev.card === self && !ev.faceDown,
      label: () => "Root Elemental - Put a creature card from your hand onto the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
