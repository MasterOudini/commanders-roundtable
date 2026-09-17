// `Towering-Wave Mystic` - a dealsDamage trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TOWERING_WAVE_MYSTIC } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TOWERING_WAVE_MYSTIC, "Whenever this creature deals damage, target player mills that many cards.");

const VOCAB_L0 = vocabularyEffects("Target player mills that many cards.", TOWERING_WAVE_MYSTIC.name, { memo: true });
const VOCAB_T_L0 = vocabularyTargets("Target player mills that many cards.");

export const TOWERING_WAVE_MYSTIC_SCRIPT: CardScript = {
  oracleId: TOWERING_WAVE_MYSTIC.oracleId,
  name: TOWERING_WAVE_MYSTIC.name,
  triggers: [
    {
      abilityId: 'dealsDamage-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self).reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.amount > 0),
      label: () => "Towering-Wave Mystic - Target player mills that many cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'dealsDamageAny-0',
      text: PRINTED,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self).reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.source === self && d.amount > 0),
      label: () => "Towering-Wave Mystic - Target player mills that many cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
