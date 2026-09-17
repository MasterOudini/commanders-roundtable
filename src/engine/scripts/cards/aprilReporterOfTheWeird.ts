// `April, Reporter of the Weird` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { APRIL_REPORTER_OF_THE_WEIRD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(APRIL_REPORTER_OF_THE_WEIRD, "Whenever April deals combat damage to a player, draw that many cards, then discard a card.");

const VOCAB_L0 = vocabularyEffects("Draw that many cards, then discard a card.", APRIL_REPORTER_OF_THE_WEIRD.name, { memo: true });
const VOCAB_T_L0 = vocabularyTargets("Draw that many cards, then discard a card.");

export const APRIL_REPORTER_OF_THE_WEIRD_SCRIPT: CardScript = {
  oracleId: APRIL_REPORTER_OF_THE_WEIRD.oracleId,
  name: APRIL_REPORTER_OF_THE_WEIRD.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self && d.target.kind === 'player').reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "April, Reporter of the Weird - Draw that many cards, then discard a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
