// `Copper Tablet` - a eachUpkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COPPER_TABLET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COPPER_TABLET, "At the beginning of each player's upkeep, this artifact deals 1 damage to that player.");

const VOCAB_L0 = vocabularyEffects("This artifact deals 1 damage to target player.", COPPER_TABLET.name);
const VOCAB_T_L0 = vocabularyTargets("This artifact deals 1 damage to target player.");

export const COPPER_TABLET_SCRIPT: CardScript = {
  oracleId: COPPER_TABLET.oracleId,
  name: COPPER_TABLET.name,
  triggers: [
    {
      abilityId: 'eachUpkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (ctx) => ctx.state.turn.activePlayer,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep',
      label: () => "Copper Tablet - This artifact deals 1 damage to target player.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'player', id: obj.player }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
