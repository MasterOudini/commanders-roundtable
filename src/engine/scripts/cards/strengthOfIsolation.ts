// `Strength of Isolation` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STRENGTH_OF_ISOLATION } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { parseProtection } from '../../../data/oracleParse';
import type { Protection } from '../../types/oracle';
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

const PRINTED = printed(STRENGTH_OF_ISOLATION, "Enchant creature\nEnchanted creature gets +1/+2 and has protection from black.\nMadness {W} (If you discard this card, discard it into exile. When you do, cast it for its madness cost or put it into your graveyard.)");
const LINES = PRINTED.split('\n');

function mergeProtection(a: Protection, b: Protection): Protection {
  return {
    colors: [...new Set([...a.colors, ...b.colors])],
    fromEverything: a.fromEverything || b.fromEverything,
    other: [...new Set([...a.other, ...b.other])],
  };
}

const PROT_1_0 = parseProtection("protection from black");

export const STRENGTH_OF_ISOLATION_SCRIPT: CardScript = {
  oracleId: STRENGTH_OF_ISOLATION.oracleId,
  name: STRENGTH_OF_ISOLATION.name,
  statics: [
    {
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.protection = mergeProtection(chars.protection, PROT_1_0);
      },
    },
  ],
};
