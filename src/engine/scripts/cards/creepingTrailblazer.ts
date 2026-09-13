// `Creeping Trailblazer` - a static anthem, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CREEPING_TRAILBLAZER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CREEPING_TRAILBLAZER, "Other Elementals you control get +1/+0.\n{2}{R}{G}: This creature gets +1/+1 until end of turn for each Elemental you control.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ gets +1/+1 until end of turn for each Elemental you control.", CREEPING_TRAILBLAZER.name);
const VOCAB_T_A0 = vocabularyTargets("~ gets +1/+1 until end of turn for each Elemental you control.");

export const CREEPING_TRAILBLAZER_SCRIPT: CardScript = {
  oracleId: CREEPING_TRAILBLAZER.oracleId,
  name: CREEPING_TRAILBLAZER.name,
  activated: [
    {
      ref: `${CREEPING_TRAILBLAZER.oracleId}#a0`,
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
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Elemental") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
