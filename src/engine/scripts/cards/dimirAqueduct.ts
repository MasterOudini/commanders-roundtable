// `Dimir Aqueduct` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DIMIR_AQUEDUCT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIMIR_AQUEDUCT, "This land enters tapped.\nWhen this land enters, return a land you control to its owner's hand.\n{T}: Add {U}{B}.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return a land you control to its owner's hand.", DIMIR_AQUEDUCT.name);
const VOCAB_T_L1 = vocabularyTargets("Return a land you control to its owner's hand.");

export const DIMIR_AQUEDUCT_SCRIPT: CardScript = {
  oracleId: DIMIR_AQUEDUCT.oracleId,
  name: DIMIR_AQUEDUCT.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Dimir Aqueduct - Return a land you control to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
