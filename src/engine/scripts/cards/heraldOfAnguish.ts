// `Herald of Anguish` - a endStep trigger vocab, an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HERALD_OF_ANGUISH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HERALD_OF_ANGUISH, "Improvise (Your artifacts can help cast this spell. Each artifact you tap after you're done activating mana abilities pays for {1}.)\nFlying\nAt the beginning of your end step, each opponent discards a card.\n{1}{B}, Sacrifice an artifact: Target creature gets -2/-2 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Each opponent discards a card.", HERALD_OF_ANGUISH.name);
const VOCAB_T_L2 = vocabularyTargets("Each opponent discards a card.");

export const HERALD_OF_ANGUISH_SCRIPT: CardScript = {
  oracleId: HERALD_OF_ANGUISH.oracleId,
  name: HERALD_OF_ANGUISH.name,
  activated: [
    {
      ref: `${HERALD_OF_ANGUISH.oracleId}#a0`,
      text: LINES[3] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: -2 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'endStep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Herald of Anguish - Each opponent discards a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
