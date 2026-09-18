// `Faerie Snoop` - a turnedFaceUp trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FAERIE_SNOOP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FAERIE_SNOOP, "Flying\nDisguise {1}{U/B}{U/B} (You may cast this card face down for {3} as a 2/2 creature with ward {2}. Turn it face up any time for its disguise cost.)\nWhen this creature is turned face up, look at the top two cards of your library. Put one into your hand and the other into your graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Look at the top two cards of your library. Put one into your hand and the other into your graveyard.", FAERIE_SNOOP.name);
const VOCAB_T_L2 = vocabularyTargets("Look at the top two cards of your library. Put one into your hand and the other into your graveyard.");

export const FAERIE_SNOOP_SCRIPT: CardScript = {
  oracleId: FAERIE_SNOOP.oracleId,
  name: FAERIE_SNOOP.name,
  triggers: [
    {
      abilityId: 'turnedFaceUp-2',
      text: LINES[2] as string,
      event: 'FaceDownSet',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'FaceDownSet' && ev.card === self && !ev.faceDown,
      label: () => "Faerie Snoop - Look at the top two cards of your library. Put one into your hand and the other into your graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
