// `Mentor of the Meek` - a anotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MENTOR_OF_THE_MEEK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MENTOR_OF_THE_MEEK, "Whenever another creature you control with power 2 or less enters, you may pay {1}. If you do, draw a card.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, draw a card.", MENTOR_OF_THE_MEEK.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, draw a card.");

export const MENTOR_OF_THE_MEEK_SCRIPT: CardScript = {
  oracleId: MENTOR_OF_THE_MEEK.oracleId,
  name: MENTOR_OF_THE_MEEK.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && (ctx.derive(m.card).power ?? 0) <= 2,
        ),
      label: () => "Mentor of the Meek - You may pay {1}. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
