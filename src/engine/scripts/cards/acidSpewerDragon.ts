// `Acid-Spewer Dragon` - a turnedFaceUp trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ACID_SPEWER_DRAGON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ACID_SPEWER_DRAGON, "Flying, deathtouch\nMegamorph {5}{B}{B} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its megamorph cost and put a +1/+1 counter on it.)\nWhen this creature is turned face up, put a +1/+1 counter on each other Dragon creature you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Put a +1/+1 counter on each other Dragon creature you control.", ACID_SPEWER_DRAGON.name);
const VOCAB_T_L2 = vocabularyTargets("Put a +1/+1 counter on each other Dragon creature you control.");

export const ACID_SPEWER_DRAGON_SCRIPT: CardScript = {
  oracleId: ACID_SPEWER_DRAGON.oracleId,
  name: ACID_SPEWER_DRAGON.name,
  triggers: [
    {
      abilityId: 'turnedFaceUp-2',
      text: LINES[2] as string,
      event: 'FaceDownSet',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'FaceDownSet' && ev.card === self && !ev.faceDown,
      label: () => "Acid-Spewer Dragon - Put a +1/+1 counter on each other Dragon creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
