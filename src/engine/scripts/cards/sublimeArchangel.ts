// `Sublime Archangel` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUBLIME_ARCHANGEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUBLIME_ARCHANGEL, "Flying\nExalted (Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn.)\nOther creatures you control have exalted. (If a creature has multiple instances of exalted, each triggers separately.)");
const LINES = PRINTED.split('\n');

export const SUBLIME_ARCHANGEL_SCRIPT: CardScript = {
  oracleId: SUBLIME_ARCHANGEL.oracleId,
  name: SUBLIME_ARCHANGEL.name,
  statics: [
    {
      abilityId: 'anthem-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("exalted");
      },
    },
  ],
};
