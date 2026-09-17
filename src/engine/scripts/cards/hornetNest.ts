// `Hornet Nest` - a isDealtCombatDamage trigger vocab, a isDealtNoncombatDamage trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HORNET_NEST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HORNET_NEST, "Defender (This creature can't attack.)\nWhenever this creature is dealt damage, create that many 1/1 green Insect creature tokens with flying and deathtouch. (Any amount of damage a creature with deathtouch deals to a creature is enough to destroy it.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create that many 1/1 green Insect creature tokens with flying and deathtouch.", HORNET_NEST.name, { memo: true });
const VOCAB_T_L1 = vocabularyTargets("Create that many 1/1 green Insect creature tokens with flying and deathtouch.");

export const HORNET_NEST_SCRIPT: CardScript = {
  oracleId: HORNET_NEST.oracleId,
  name: HORNET_NEST.name,
  triggers: [
    {
      abilityId: 'isDealtCombatDamage-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.target.kind === 'card' && d.target.id === self).reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "Hornet Nest - Create that many 1/1 green Insect creature tokens with flying and deathtouch.",
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
      label: () => "Hornet Nest - Create that many 1/1 green Insect creature tokens with flying and deathtouch.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
