// `Dragon Tyrant` - a upkeep trigger vocab, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRAGON_TYRANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRAGON_TYRANT, "Flying, trample\nDouble strike (This creature deals both first-strike and regular combat damage.)\nAt the beginning of your upkeep, sacrifice this creature unless you pay {R}{R}{R}{R}.\n{R}: This creature gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Sacrifice this creature unless you pay {R}{R}{R}{R}.", DRAGON_TYRANT.name);
const VOCAB_T_L2 = vocabularyTargets("Sacrifice this creature unless you pay {R}{R}{R}{R}.");

export const DRAGON_TYRANT_SCRIPT: CardScript = {
  oracleId: DRAGON_TYRANT.oracleId,
  name: DRAGON_TYRANT.name,
  activated: [
    {
      ref: `${DRAGON_TYRANT.oracleId}#a0`,
      text: LINES[3] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Dragon Tyrant - Sacrifice this creature unless you pay {R}{R}{R}{R}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
