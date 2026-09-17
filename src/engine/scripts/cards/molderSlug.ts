// `Molder Slug` - a eachUpkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOLDER_SLUG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOLDER_SLUG, "At the beginning of each player's upkeep, that player sacrifices an artifact of their choice.");

const VOCAB_L0 = vocabularyEffects("Target player sacrifices an artifact of target player's choice.", MOLDER_SLUG.name);
const VOCAB_T_L0 = vocabularyTargets("Target player sacrifices an artifact of target player's choice.");

export const MOLDER_SLUG_SCRIPT: CardScript = {
  oracleId: MOLDER_SLUG.oracleId,
  name: MOLDER_SLUG.name,
  triggers: [
    {
      abilityId: 'eachUpkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (ctx) => ctx.state.turn.activePlayer,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep',
      label: () => "Molder Slug - Target player sacrifices an artifact of target player's choice.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
