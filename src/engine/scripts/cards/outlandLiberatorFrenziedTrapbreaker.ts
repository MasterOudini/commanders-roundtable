// `Outland Liberator // Frenzied Trapbreaker` - an activation vocab, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OUTLAND_LIBERATOR_FRENZIED_TRAPBREAKER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(OUTLAND_LIBERATOR_FRENZIED_TRAPBREAKER, "{1}, Sacrifice this creature: Destroy target artifact or enchantment.\nDaybound (If a player casts no spells during their own turn, it becomes night next turn.)\n{1}, Sacrifice this creature: Destroy target artifact or enchantment.\nWhenever this creature attacks, destroy target artifact or enchantment defending player controls.\nNightbound (If a player casts at least two spells during their own turn, it becomes day next turn.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Destroy target artifact or enchantment.", OUTLAND_LIBERATOR_FRENZIED_TRAPBREAKER.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target artifact or enchantment.");
const VOCAB_L3 = vocabularyEffects("Destroy target artifact or enchantment defending player controls.", OUTLAND_LIBERATOR_FRENZIED_TRAPBREAKER.name);
const VOCAB_T_L3 = vocabularyTargets("Destroy target artifact or enchantment defending player controls.");

export const OUTLAND_LIBERATOR_FRENZIED_TRAPBREAKER_SCRIPT: CardScript = {
  oracleId: OUTLAND_LIBERATOR_FRENZIED_TRAPBREAKER.oracleId,
  name: OUTLAND_LIBERATOR_FRENZIED_TRAPBREAKER.name,
  activated: [
    {
      ref: `${OUTLAND_LIBERATOR_FRENZIED_TRAPBREAKER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'attacks-3', face: 1,
      text: LINES[3] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L3,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Outland Liberator // Frenzied Trapbreaker - Destroy target artifact or enchantment defending player controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};
