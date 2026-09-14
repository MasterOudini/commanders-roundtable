// `Demonic Appetite` - a static attachedStatic, a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEMONIC_APPETITE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEMONIC_APPETITE, "Enchant creature you control\nEnchanted creature gets +3/+3.\nAt the beginning of your upkeep, sacrifice a creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Sacrifice a creature.", DEMONIC_APPETITE.name);
const VOCAB_T_L2 = vocabularyTargets("Sacrifice a creature.");

export const DEMONIC_APPETITE_SCRIPT: CardScript = {
  oracleId: DEMONIC_APPETITE.oracleId,
  name: DEMONIC_APPETITE.name,
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Demonic Appetite - Sacrifice a creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 3;
        if (chars.toughness !== null) chars.toughness += 3;
      },
    },
  ],
};
