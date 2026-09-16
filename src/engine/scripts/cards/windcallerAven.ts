// `Windcaller Aven` - a cycleThisCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WINDCALLER_AVEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WINDCALLER_AVEN, "Flying\nCycling {U} ({U}, Discard this card: Draw a card.)\nWhen you cycle this card, target creature gains flying until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Target creature gains flying until end of turn.", WINDCALLER_AVEN.name);
const VOCAB_T_L2 = vocabularyTargets("Target creature gains flying until end of turn.");

export const WINDCALLER_AVEN_SCRIPT: CardScript = {
  oracleId: WINDCALLER_AVEN.oracleId,
  name: WINDCALLER_AVEN.name,
  triggers: [
    {
      abilityId: 'cycleThisCard-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ["hand"],
      optional: false,
      targets: VOCAB_T_L2,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.reason === 'cycling'),
      label: () => "Windcaller Aven - Target creature gains flying until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
