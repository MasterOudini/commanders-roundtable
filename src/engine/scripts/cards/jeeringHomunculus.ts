// `Jeering Homunculus` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JEERING_HOMUNCULUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JEERING_HOMUNCULUS, "When this creature enters, you may goad target creature. (Until your next turn, that creature attacks each combat if able and attacks a player other than you if able.)");

const VOCAB_L0 = vocabularyEffects("Goad target creature.", JEERING_HOMUNCULUS.name);
const VOCAB_T_L0 = vocabularyTargets("Goad target creature.");

export const JEERING_HOMUNCULUS_SCRIPT: CardScript = {
  oracleId: JEERING_HOMUNCULUS.oracleId,
  name: JEERING_HOMUNCULUS.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Jeering Homunculus - Goad target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
