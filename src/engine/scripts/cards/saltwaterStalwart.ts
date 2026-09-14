// `Saltwater Stalwart` - a dealsDamageOpponent trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SALTWATER_STALWART } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SALTWATER_STALWART, "Whenever this creature deals damage to an opponent, target player draws a card.");

const VOCAB_L0 = vocabularyEffects("Target player draws a card.", SALTWATER_STALWART.name);
const VOCAB_T_L0 = vocabularyTargets("Target player draws a card.");

export const SALTWATER_STALWART_SCRIPT: CardScript = {
  oracleId: SALTWATER_STALWART.oracleId,
  name: SALTWATER_STALWART.name,
  triggers: [
    {
      abilityId: 'dealsDamageOpponent-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.target.id !== ctx.query.controllerOf(self) && d.amount > 0),
      label: () => "Saltwater Stalwart - Target player draws a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'dealsDamageOpponentAny-0',
      text: PRINTED,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.target.id !== ctx.query.controllerOf(self) && d.amount > 0),
      label: () => "Saltwater Stalwart - Target player draws a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
