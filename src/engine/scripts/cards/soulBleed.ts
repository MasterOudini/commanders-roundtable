// `Soul Bleed` - a enchantedControllerUpkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOUL_BLEED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOUL_BLEED, "Enchant creature\nAt the beginning of the upkeep of enchanted creature's controller, that player loses 1 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target player loses 1 life.", SOUL_BLEED.name);
const VOCAB_T_L1 = vocabularyTargets("Target player loses 1 life.");

export const SOUL_BLEED_SCRIPT: CardScript = {
  oracleId: SOUL_BLEED.oracleId,
  name: SOUL_BLEED.name,
  triggers: [
    {
      abilityId: 'enchantedControllerUpkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (ctx) => ctx.state.turn.activePlayer,
      matches: (ctx, self, ev) => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        return ev.t === 'StepBegan' && ev.step === 'upkeep' && host !== null && ctx.state.turn.activePlayer === ctx.state.cards[host]?.controller;
      },
      label: () => "Soul Bleed - Target player loses 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'player', id: obj.player }] }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
