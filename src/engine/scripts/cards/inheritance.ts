// `Inheritance` - a aCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INHERITANCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INHERITANCE, "Whenever a creature dies, you may pay {3}. If you do, draw a card.");

const VOCAB_L0 = vocabularyEffects("You may pay {3}. If you do, draw a card.", INHERITANCE.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {3}. If you do, draw a card.");

export const INHERITANCE_SCRIPT: CardScript = {
  oracleId: INHERITANCE.oracleId,
  name: INHERITANCE.name,
  triggers: [
    {
      abilityId: 'aCreatureDies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')),
      label: () => "Inheritance - You may pay {3}. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
