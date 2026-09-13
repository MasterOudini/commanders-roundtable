// `Pious Wayfarer` - a creatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PIOUS_WAYFARER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PIOUS_WAYFARER, "Constellation — Whenever an enchantment you control enters, target creature gets +1/+1 until end of turn.");

const VOCAB_L0 = vocabularyEffects("Target creature gets +1/+1 until end of turn.", PIOUS_WAYFARER.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature gets +1/+1 until end of turn.");

export const PIOUS_WAYFARER_SCRIPT: CardScript = {
  oracleId: PIOUS_WAYFARER.oracleId,
  name: PIOUS_WAYFARER.name,
  triggers: [
    {
      abilityId: 'creatureEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Enchantment'),
        ),
      label: () => "Pious Wayfarer - Target creature gets +1/+1 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
