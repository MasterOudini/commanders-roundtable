// `Life Insurance` - a anotherCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LIFE_INSURANCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LIFE_INSURANCE, "Extort (Whenever you cast a spell, you may pay {W/B}. If you do, each opponent loses 1 life and you gain that much life.)\nWhenever a nontoken creature dies, you lose 1 life and create a Treasure token.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You lose 1 life and create a Treasure token.", LIFE_INSURANCE.name);
const VOCAB_T_L1 = vocabularyTargets("You lose 1 life and create a Treasure token.");

export const LIFE_INSURANCE_SCRIPT: CardScript = {
  oracleId: LIFE_INSURANCE.oracleId,
  name: LIFE_INSURANCE.name,
  triggers: [
    {
      abilityId: 'anotherCreatureDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature') && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Life Insurance - You lose 1 life and create a Treasure token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
