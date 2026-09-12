// `Ire Shaman` - a turnedFaceUp trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IRE_SHAMAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IRE_SHAMAN, "Menace (This creature can't be blocked except by two or more creatures.)\nMegamorph {R} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its megamorph cost and put a +1/+1 counter on it.)\nWhen this creature is turned face up, exile the top card of your library. Until end of turn, you may play that card.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Exile the top card of your library. Until end of turn, you may play that card.", IRE_SHAMAN.name);
const VOCAB_T_L2 = vocabularyTargets("Exile the top card of your library. Until end of turn, you may play that card.");

export const IRE_SHAMAN_SCRIPT: CardScript = {
  oracleId: IRE_SHAMAN.oracleId,
  name: IRE_SHAMAN.name,
  triggers: [
    {
      abilityId: 'turnedFaceUp-2',
      text: LINES[2] as string,
      event: 'FaceDownSet',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'FaceDownSet' && ev.card === self && !ev.faceDown,
      label: () => "Ire Shaman - Exile the top card of your library. Until end of turn, you may play that card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
