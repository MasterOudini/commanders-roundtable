// `Glint-Eye Nephilim` - a combatDamagePlayer trigger vocab, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLINT_EYE_NEPHILIM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLINT_EYE_NEPHILIM, "Whenever this creature deals combat damage to a player, draw that many cards.\n{1}, Discard a card: This creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Draw that many cards.", GLINT_EYE_NEPHILIM.name, { memo: true });
const VOCAB_T_L0 = vocabularyTargets("Draw that many cards.");

export const GLINT_EYE_NEPHILIM_SCRIPT: CardScript = {
  oracleId: GLINT_EYE_NEPHILIM.oracleId,
  name: GLINT_EYE_NEPHILIM.name,
  activated: [
    {
      ref: `${GLINT_EYE_NEPHILIM.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'combatDamagePlayer-0',
      text: LINES[0] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self && d.target.kind === 'player').reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Glint-Eye Nephilim - Draw that many cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
