// `Farmstead` - a static attachedStatic, a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FARMSTEAD } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
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

const PRINTED = printed(FARMSTEAD, "Enchant land\nEnchanted land has \"At the beginning of your upkeep, you may pay {W}{W}. If you do, you gain 1 life.\"");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {W}{W}. If you do, you gain 1 life.", FARMSTEAD.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {W}{W}. If you do, you gain 1 life.");

const GRANT_1 = grantedTriggerRef(`${FARMSTEAD.oracleId}#gt1`, FARMSTEAD.name);

export const FARMSTEAD_SCRIPT: CardScript = {
  oracleId: FARMSTEAD.oracleId,
  name: FARMSTEAD.name,
  triggers: [
    {
      abilityId: 'gt1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Farmstead - You may pay {W}{W}. If you do, you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: GRANT_1 });
      },
    },
  ],
};
