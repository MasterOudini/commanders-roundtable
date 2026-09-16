// `Adaptive Automaton` - a static typeAdd, a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ADAPTIVE_AUTOMATON } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

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

const PRINTED = printed(ADAPTIVE_AUTOMATON, "As this creature enters, choose a creature type.\nThis creature is the chosen type in addition to its other types.\nOther creatures you control of the chosen type get +1/+1.");
const LINES = PRINTED.split('\n');

export const ADAPTIVE_AUTOMATON_SCRIPT: CardScript = {
  oracleId: ADAPTIVE_AUTOMATON.oracleId,
  name: ADAPTIVE_AUTOMATON.name,
  statics: [
    {
      abilityId: 'type-add-1',
      text: LINES[1] as string,
      layer: 'type',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && ctx.state.cards[self]?.chosenType !== null,
      modify: (chars, ctx, self) => {
        const t = ctx.state.cards[self]?.chosenType;
        if (t && !chars.typeLine.subtypes.includes(t)) chars.typeLine = { ...chars.typeLine, subtypes: [...chars.typeLine.subtypes, t] };
      },
    },
    {
      abilityId: 'anthem-pt-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes(ctx.state.cards[self]?.chosenType ?? '') && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
