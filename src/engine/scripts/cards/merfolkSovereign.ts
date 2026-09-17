// `Merfolk Sovereign` - a static anthem, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MERFOLK_SOVEREIGN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MERFOLK_SOVEREIGN, "Other Merfolk creatures you control get +1/+1.\n{T}: Target Merfolk creature can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target Merfolk creature can't be blocked this turn.", MERFOLK_SOVEREIGN.name);
const VOCAB_T_A0 = vocabularyTargets("Target Merfolk creature can't be blocked this turn.");

export const MERFOLK_SOVEREIGN_SCRIPT: CardScript = {
  oracleId: MERFOLK_SOVEREIGN.oracleId,
  name: MERFOLK_SOVEREIGN.name,
  activated: [
    {
      ref: `${MERFOLK_SOVEREIGN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Merfolk") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
