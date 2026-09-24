// `Keiga, the Tide Star` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KEIGA_THE_TIDE_STAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KEIGA_THE_TIDE_STAR, "Flying\nWhen Keiga dies, gain control of target creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Gain control of target creature.", KEIGA_THE_TIDE_STAR.name);
const VOCAB_T_L1 = vocabularyTargets("Gain control of target creature.");

export const KEIGA_THE_TIDE_STAR_SCRIPT: CardScript = {
  oracleId: KEIGA_THE_TIDE_STAR.oracleId,
  name: KEIGA_THE_TIDE_STAR.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Keiga, the Tide Star - Gain control of target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
