// `Exalted Angel` - a dealsDamage trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EXALTED_ANGEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EXALTED_ANGEL, "Flying\nWhenever this creature deals damage, you gain that much life.\nMorph {2}{W}{W} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You gain that much life.", EXALTED_ANGEL.name, { memo: true });
const VOCAB_T_L1 = vocabularyTargets("You gain that much life.");

export const EXALTED_ANGEL_SCRIPT: CardScript = {
  oracleId: EXALTED_ANGEL.oracleId,
  name: EXALTED_ANGEL.name,
  triggers: [
    {
      abilityId: 'dealsDamage-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self).reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.amount > 0),
      label: () => "Exalted Angel - You gain that much life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'dealsDamageAny-1',
      text: LINES[1] as string,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self).reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.source === self && d.amount > 0),
      label: () => "Exalted Angel - You gain that much life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
