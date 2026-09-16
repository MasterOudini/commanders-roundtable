// `Forum Familiar` - a turnedFaceUp trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FORUM_FAMILIAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FORUM_FAMILIAR, "Disguise {1}{W} (You may cast this card face down for {3} as a 2/2 creature with ward {2}. Turn it face up any time for its disguise cost.)\nWhen this creature is turned face up, return another target permanent you control to its owner's hand and put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return another target permanent you control to its owner's hand and put a +1/+1 counter on this creature.", FORUM_FAMILIAR.name);
const VOCAB_T_L1 = vocabularyTargets("Return another target permanent you control to its owner's hand and put a +1/+1 counter on this creature.");

export const FORUM_FAMILIAR_SCRIPT: CardScript = {
  oracleId: FORUM_FAMILIAR.oracleId,
  name: FORUM_FAMILIAR.name,
  triggers: [
    {
      abilityId: 'turnedFaceUp-1',
      text: LINES[1] as string,
      event: 'FaceDownSet',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'FaceDownSet' && ev.card === self && !ev.faceDown,
      label: () => "Forum Familiar - Return another target permanent you control to its owner's hand and put a +1/+1 counter on this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
