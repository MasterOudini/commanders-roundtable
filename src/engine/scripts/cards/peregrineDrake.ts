// `Peregrine Drake` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PEREGRINE_DRAKE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PEREGRINE_DRAKE, "Flying\nWhen this creature enters, untap up to five lands.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Untap up to five lands.", PEREGRINE_DRAKE.name);
const VOCAB_T_L1 = vocabularyTargets("Untap up to five lands.");

export const PEREGRINE_DRAKE_SCRIPT: CardScript = {
  oracleId: PEREGRINE_DRAKE.oracleId,
  name: PEREGRINE_DRAKE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Peregrine Drake - Untap up to five lands.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
