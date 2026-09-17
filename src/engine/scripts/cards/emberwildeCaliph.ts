// `Emberwilde Caliph` - a static mustAttack, a dealsDamage trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EMBERWILDE_CALIPH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EMBERWILDE_CALIPH, "Flying, trample\nThis creature attacks each combat if able.\nWhenever this creature deals damage, you lose that much life.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("You lose that much life.", EMBERWILDE_CALIPH.name, { memo: true });
const VOCAB_T_L2 = vocabularyTargets("You lose that much life.");

export const EMBERWILDE_CALIPH_SCRIPT: CardScript = {
  oracleId: EMBERWILDE_CALIPH.oracleId,
  name: EMBERWILDE_CALIPH.name,
  triggers: [
    {
      abilityId: 'dealsDamage-2',
      text: LINES[2] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self).reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.amount > 0),
      label: () => "Emberwilde Caliph - You lose that much life.",
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
      label: () => "Emberwilde Caliph - You lose that much life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  combat: [
    {
      abilityId: 'mustAttack-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
