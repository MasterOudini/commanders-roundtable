// `Captivating Unicorn` - a creatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAPTIVATING_UNICORN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CAPTIVATING_UNICORN, "Constellation — Whenever an enchantment you control enters, tap target creature an opponent controls.");

const VOCAB_L0 = vocabularyEffects("Tap target creature an opponent controls.", CAPTIVATING_UNICORN.name);
const VOCAB_T_L0 = vocabularyTargets("Tap target creature an opponent controls.");

export const CAPTIVATING_UNICORN_SCRIPT: CardScript = {
  oracleId: CAPTIVATING_UNICORN.oracleId,
  name: CAPTIVATING_UNICORN.name,
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
      label: () => "Captivating Unicorn - Tap target creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
