// `Vile Consumption` - a static anthem, a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VILE_CONSUMPTION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VILE_CONSUMPTION, "All creatures have \"At the beginning of your upkeep, sacrifice this creature unless you pay 1 life.\"");

const VOCAB_L0 = vocabularyEffects("Sacrifice ~ unless you pay 1 life.", VILE_CONSUMPTION.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice ~ unless you pay 1 life.");

const GRANT_0 = grantedTriggerRef(`${VILE_CONSUMPTION.oracleId}#gt0`, VILE_CONSUMPTION.name);

export const VILE_CONSUMPTION_SCRIPT: CardScript = {
  oracleId: VILE_CONSUMPTION.oracleId,
  name: VILE_CONSUMPTION.name,
  triggers: [
    {
      abilityId: 'gt0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Vile Consumption - Sacrifice ~ unless you pay 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, _self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.types.includes("Creature"),
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: GRANT_0 });
      },
    },
  ],
};
