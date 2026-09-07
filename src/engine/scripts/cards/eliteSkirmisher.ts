// `Elite Skirmisher` - a heroic trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELITE_SKIRMISHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELITE_SKIRMISHER, "Heroic — Whenever you cast a spell that targets this creature, you may tap target creature.");

const VOCAB_L0 = vocabularyEffects("Tap target creature.", ELITE_SKIRMISHER.name);
const VOCAB_T_L0 = vocabularyTargets("Tap target creature.");

export const ELITE_SKIRMISHER_SCRIPT: CardScript = {
  oracleId: ELITE_SKIRMISHER.oracleId,
  name: ELITE_SKIRMISHER.name,
  triggers: [
    {
      abilityId: 'heroic-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Elite Skirmisher - Tap target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
