// `Herald of Hoofbeats` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HERALD_OF_HOOFBEATS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HERALD_OF_HOOFBEATS, "Horsemanship (This creature can't be blocked except by creatures with horsemanship.)\nOther Knights you control have horsemanship.");
const LINES = PRINTED.split('\n');

export const HERALD_OF_HOOFBEATS_SCRIPT: CardScript = {
  oracleId: HERALD_OF_HOOFBEATS.oracleId,
  name: HERALD_OF_HOOFBEATS.name,
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Knight") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("horsemanship");
      },
    },
  ],
};
