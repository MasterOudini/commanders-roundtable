// `Jeskai Barricade` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JESKAI_BARRICADE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JESKAI_BARRICADE, "Flash (You may cast this spell any time you could cast an instant.)\nDefender\nWhen this creature enters, you may return another target creature you control to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Return another target creature you control to its owner's hand.", JESKAI_BARRICADE.name);
const VOCAB_T_L2 = vocabularyTargets("Return another target creature you control to its owner's hand.");

export const JESKAI_BARRICADE_SCRIPT: CardScript = {
  oracleId: JESKAI_BARRICADE.oracleId,
  name: JESKAI_BARRICADE.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Jeskai Barricade - Return another target creature you control to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
