// `Mourning Thrull` - a dealsDamage trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOURNING_THRULL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOURNING_THRULL, "({W/B} can be paid with either {W} or {B}.)\nFlying\nWhenever this creature deals damage, you gain that much life.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("You gain that much life.", MOURNING_THRULL.name, { memo: true });
const VOCAB_T_L2 = vocabularyTargets("You gain that much life.");

export const MOURNING_THRULL_SCRIPT: CardScript = {
  oracleId: MOURNING_THRULL.oracleId,
  name: MOURNING_THRULL.name,
  triggers: [
    {
      abilityId: 'dealsDamage-2',
      text: LINES[2] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self).reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.amount > 0),
      label: () => "Mourning Thrull - You gain that much life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
    {
      abilityId: 'dealsDamageAny-2',
      text: LINES[2] as string,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self).reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.source === self && d.amount > 0),
      label: () => "Mourning Thrull - You gain that much life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
