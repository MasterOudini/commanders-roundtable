// `Imperial Hellkite` - a turnedFaceUp trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IMPERIAL_HELLKITE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IMPERIAL_HELLKITE, "Flying\nMorph {6}{R}{R} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)\nWhen this creature is turned face up, you may search your library for a Dragon card, reveal it, put it into your hand, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Search your library for a Dragon card, reveal it, put it into your hand, then shuffle.", IMPERIAL_HELLKITE.name);
const VOCAB_T_L2 = vocabularyTargets("Search your library for a Dragon card, reveal it, put it into your hand, then shuffle.");

export const IMPERIAL_HELLKITE_SCRIPT: CardScript = {
  oracleId: IMPERIAL_HELLKITE.oracleId,
  name: IMPERIAL_HELLKITE.name,
  triggers: [
    {
      abilityId: 'turnedFaceUp-2',
      text: LINES[2] as string,
      event: 'FaceDownSet',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) => ev.t === 'FaceDownSet' && ev.card === self && !ev.faceDown,
      label: () => "Imperial Hellkite - Search your library for a Dragon card, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
