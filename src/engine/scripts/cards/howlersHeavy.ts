// `Howler's Heavy` - a cycleThisCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HOWLER_S_HEAVY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HOWLER_S_HEAVY, "Cycling {1}{U} ({1}{U}, Discard this card: Draw a card.)\nWhen you cycle this card, target creature or Vehicle an opponent controls gets -3/-0 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature or Vehicle an opponent controls gets -3/-0 until end of turn.", HOWLER_S_HEAVY.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature or Vehicle an opponent controls gets -3/-0 until end of turn.");

export const HOWLERS_HEAVY_SCRIPT: CardScript = {
  oracleId: HOWLER_S_HEAVY.oracleId,
  name: HOWLER_S_HEAVY.name,
  triggers: [
    {
      abilityId: 'cycleThisCard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ["hand"],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.reason === 'cycling'),
      label: () => "Howler's Heavy - Target creature or Vehicle an opponent controls gets -3/-0 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
