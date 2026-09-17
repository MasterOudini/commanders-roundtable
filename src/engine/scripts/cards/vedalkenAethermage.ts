// `Vedalken Aethermage` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VEDALKEN_AETHERMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VEDALKEN_AETHERMAGE, "Flash (You may cast this spell any time you could cast an instant.)\nWhen this creature enters, return target Sliver to its owner's hand.\nWizardcycling {3} ({3}, Discard this card: Search your library for a Wizard card, reveal it, put it into your hand, then shuffle.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target Sliver to its owner's hand.", VEDALKEN_AETHERMAGE.name);
const VOCAB_T_L1 = vocabularyTargets("Return target Sliver to its owner's hand.");

export const VEDALKEN_AETHERMAGE_SCRIPT: CardScript = {
  oracleId: VEDALKEN_AETHERMAGE.oracleId,
  name: VEDALKEN_AETHERMAGE.name,
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
      label: () => "Vedalken Aethermage - Return target Sliver to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
