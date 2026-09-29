// `Savai Thundermane` - a youCycle trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAVAI_THUNDERMANE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAVAI_THUNDERMANE, "Whenever you cycle a card, you may pay {2}. When you do, this creature deals 2 damage to target creature and you gain 2 life.");

const VOCAB_L0 = vocabularyEffects("You may pay {2}. When you do, this creature deals 2 damage to target creature and you gain 2 life.", SAVAI_THUNDERMANE.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {2}. When you do, this creature deals 2 damage to target creature and you gain 2 life.");

export const SAVAI_THUNDERMANE_SCRIPT: CardScript = {
  oracleId: SAVAI_THUNDERMANE.oracleId,
  name: SAVAI_THUNDERMANE.name,
  triggers: [
    {
      abilityId: 'youCycle-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'cycling' && m.from.kind === 'hand' && m.from.player === ctx.query.controllerOf(self),
        ),
      label: () => "Savai Thundermane - You may pay {2}. When you do, this creature deals 2 damage to target creature and you gain 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
