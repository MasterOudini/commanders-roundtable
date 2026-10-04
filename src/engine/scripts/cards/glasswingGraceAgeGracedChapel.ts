// `Glasswing Grace // Age-Graced Chapel` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLASSWING_GRACE_AGE_GRACED_CHAPEL } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(GLASSWING_GRACE_AGE_GRACED_CHAPEL, "Enchant creature\nEnchanted creature gets +2/+2 and has flying and lifelink.\nThis land enters tapped.\n{T}: Add {W} or {B}.");
const LINES = PRINTED.split('\n');

export const GLASSWING_GRACE_AGE_GRACED_CHAPEL_SCRIPT: CardScript = {
  oracleId: GLASSWING_GRACE_AGE_GRACED_CHAPEL.oracleId,
  name: GLASSWING_GRACE_AGE_GRACED_CHAPEL.name,
  statics: [
    {
      abilityId: 'attached-pt-1', face: 0,
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
    {
      abilityId: 'attached-grant-1', face: 0,
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("flying");
        chars.keywords.add("lifelink");
      },
    },
  ],
};
