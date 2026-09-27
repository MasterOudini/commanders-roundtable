// `Protective Parents` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PROTECTIVE_PARENTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PROTECTIVE_PARENTS, "When this creature dies, create a Young Hero Role token attached to up to one target creature you control. (If you control another Role on it, put that one into the graveyard. Enchanted creature has \"Whenever this creature attacks, if its toughness is 3 or less, put a +1/+1 counter on it.\")");

const VOCAB_L0 = vocabularyEffects("Create a Young Hero Role token attached to up to one target creature you control.", PROTECTIVE_PARENTS.name);
const VOCAB_T_L0 = vocabularyTargets("Create a Young Hero Role token attached to up to one target creature you control.");

export const PROTECTIVE_PARENTS_SCRIPT: CardScript = {
  oracleId: PROTECTIVE_PARENTS.oracleId,
  name: PROTECTIVE_PARENTS.name,
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
      label: () => "Protective Parents - Create a Young Hero Role token attached to up to one target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
