// `Gravpack Monoist` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRAVPACK_MONOIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRAVPACK_MONOIST, "Flying\nWhen this creature dies, create a tapped 2/2 colorless Robot artifact creature token.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create a tapped 2/2 colorless Robot artifact creature token.", GRAVPACK_MONOIST.name);
const VOCAB_T_L1 = vocabularyTargets("Create a tapped 2/2 colorless Robot artifact creature token.");

export const GRAVPACK_MONOIST_SCRIPT: CardScript = {
  oracleId: GRAVPACK_MONOIST.oracleId,
  name: GRAVPACK_MONOIST.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Gravpack Monoist - Create a tapped 2/2 colorless Robot artifact creature token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
