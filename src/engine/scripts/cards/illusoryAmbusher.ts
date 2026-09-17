// `Illusory Ambusher` - a isDealtCombatDamage trigger vocab, a isDealtNoncombatDamage trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ILLUSORY_AMBUSHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ILLUSORY_AMBUSHER, "Flash (You may cast this spell any time you could cast an instant.)\nWhenever this creature is dealt damage, draw that many cards.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Draw that many cards.", ILLUSORY_AMBUSHER.name, { memo: true });
const VOCAB_T_L1 = vocabularyTargets("Draw that many cards.");

export const ILLUSORY_AMBUSHER_SCRIPT: CardScript = {
  oracleId: ILLUSORY_AMBUSHER.oracleId,
  name: ILLUSORY_AMBUSHER.name,
  triggers: [
    {
      abilityId: 'isDealtCombatDamage-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.target.kind === 'card' && d.target.id === self).reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "Illusory Ambusher - Draw that many cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'isDealtNoncombatDamage-1',
      text: LINES[1] as string,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.target.kind === 'card' && d.target.id === self).reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "Illusory Ambusher - Draw that many cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
