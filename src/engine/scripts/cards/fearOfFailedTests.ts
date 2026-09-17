// `Fear of Failed Tests` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FEAR_OF_FAILED_TESTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FEAR_OF_FAILED_TESTS, "Whenever this creature deals combat damage to a player, draw that many cards.");

const VOCAB_L0 = vocabularyEffects("Draw that many cards.", FEAR_OF_FAILED_TESTS.name, { memo: true });
const VOCAB_T_L0 = vocabularyTargets("Draw that many cards.");

export const FEAR_OF_FAILED_TESTS_SCRIPT: CardScript = {
  oracleId: FEAR_OF_FAILED_TESTS.oracleId,
  name: FEAR_OF_FAILED_TESTS.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self && d.target.kind === 'player').reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Fear of Failed Tests - Draw that many cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
