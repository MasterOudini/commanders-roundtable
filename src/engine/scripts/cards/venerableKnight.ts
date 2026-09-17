// `Venerable Knight` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VENERABLE_KNIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VENERABLE_KNIGHT, "When this creature dies, put a +1/+1 counter on target Knight you control.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on target Knight you control.", VENERABLE_KNIGHT.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on target Knight you control.");

export const VENERABLE_KNIGHT_SCRIPT: CardScript = {
  oracleId: VENERABLE_KNIGHT.oracleId,
  name: VENERABLE_KNIGHT.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Venerable Knight - Put a +1/+1 counter on target Knight you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
