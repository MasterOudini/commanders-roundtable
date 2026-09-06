// `Chime of Night` - a auraToGraveyard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHIME_OF_NIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHIME_OF_NIGHT, "Enchant creature\nWhen this Aura is put into a graveyard from the battlefield, destroy target nonblack creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy target nonblack creature.", CHIME_OF_NIGHT.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy target nonblack creature.");

export const CHIME_OF_NIGHT_SCRIPT: CardScript = {
  oracleId: CHIME_OF_NIGHT.oracleId,
  name: CHIME_OF_NIGHT.name,
  triggers: [
    {
      abilityId: 'auraToGraveyard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Chime of Night - Destroy target nonblack creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
