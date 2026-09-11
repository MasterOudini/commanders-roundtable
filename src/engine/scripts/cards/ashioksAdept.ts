// `Ashiok's Adept` - a heroic trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ASHIOK_S_ADEPT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ASHIOK_S_ADEPT, "Heroic — Whenever you cast a spell that targets this creature, each opponent discards a card.");

const VOCAB_L0 = vocabularyEffects("Each opponent discards a card.", ASHIOK_S_ADEPT.name);
const VOCAB_T_L0 = vocabularyTargets("Each opponent discards a card.");

export const ASHIOKS_ADEPT_SCRIPT: CardScript = {
  oracleId: ASHIOK_S_ADEPT.oracleId,
  name: ASHIOK_S_ADEPT.name,
  triggers: [
    {
      abilityId: 'heroic-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Ashiok's Adept - Each opponent discards a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
