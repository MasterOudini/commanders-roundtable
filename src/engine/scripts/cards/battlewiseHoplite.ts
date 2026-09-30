// `Battlewise Hoplite` - a heroic trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BATTLEWISE_HOPLITE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BATTLEWISE_HOPLITE, "Heroic — Whenever you cast a spell that targets this creature, put a +1/+1 counter on this creature, then scry 1. (To scry 1, look at the top card of your library, then you may put that card on the bottom.)");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on this creature, then scry 1.", BATTLEWISE_HOPLITE.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on this creature, then scry 1.");

export const BATTLEWISE_HOPLITE_SCRIPT: CardScript = {
  oracleId: BATTLEWISE_HOPLITE.oracleId,
  name: BATTLEWISE_HOPLITE.name,
  triggers: [
    {
      abilityId: 'heroic-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Battlewise Hoplite - Put a +1/+1 counter on this creature, then scry 1.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
