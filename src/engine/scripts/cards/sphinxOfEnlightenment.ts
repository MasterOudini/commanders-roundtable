// `Sphinx of Enlightenment` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPHINX_OF_ENLIGHTENMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPHINX_OF_ENLIGHTENMENT, "Flying\nWhen this creature enters, target opponent draws a card and you draw three cards.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target opponent draws a card and you draw three cards.", SPHINX_OF_ENLIGHTENMENT.name);
const VOCAB_T_L1 = vocabularyTargets("Target opponent draws a card and you draw three cards.");

export const SPHINX_OF_ENLIGHTENMENT_SCRIPT: CardScript = {
  oracleId: SPHINX_OF_ENLIGHTENMENT.oracleId,
  name: SPHINX_OF_ENLIGHTENMENT.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sphinx of Enlightenment - Target opponent draws a card and you draw three cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
