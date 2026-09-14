// `Shoal Kraken` - a creatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHOAL_KRAKEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHOAL_KRAKEN, "Constellation — Whenever an enchantment you control enters, you may draw a card. If you do, discard a card.");

const VOCAB_L0 = vocabularyEffects("Draw a card. If you do, discard a card.", SHOAL_KRAKEN.name);
const VOCAB_T_L0 = vocabularyTargets("Draw a card. If you do, discard a card.");

export const SHOAL_KRAKEN_SCRIPT: CardScript = {
  oracleId: SHOAL_KRAKEN.oracleId,
  name: SHOAL_KRAKEN.name,
  triggers: [
    {
      abilityId: 'creatureEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Enchantment'),
        ),
      label: () => "Shoal Kraken - Draw a card. If you do, discard a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
