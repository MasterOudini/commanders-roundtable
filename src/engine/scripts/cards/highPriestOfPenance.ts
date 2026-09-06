// `High Priest of Penance` - a isDealtCombatDamage trigger vocab, a isDealtNoncombatDamage trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HIGH_PRIEST_OF_PENANCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HIGH_PRIEST_OF_PENANCE, "Whenever this creature is dealt damage, you may destroy target nonland permanent.");

const VOCAB_L0 = vocabularyEffects("Destroy target nonland permanent.", HIGH_PRIEST_OF_PENANCE.name);
const VOCAB_T_L0 = vocabularyTargets("Destroy target nonland permanent.");

export const HIGH_PRIEST_OF_PENANCE_SCRIPT: CardScript = {
  oracleId: HIGH_PRIEST_OF_PENANCE.oracleId,
  name: HIGH_PRIEST_OF_PENANCE.name,
  triggers: [
    {
      abilityId: 'isDealtCombatDamage-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "High Priest of Penance - Destroy target nonland permanent.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'isDealtNoncombatDamage-0',
      text: PRINTED,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "High Priest of Penance - Destroy target nonland permanent.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
