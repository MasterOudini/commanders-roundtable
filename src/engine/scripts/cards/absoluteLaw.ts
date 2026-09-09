// `Absolute Law` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ABSOLUTE_LAW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ABSOLUTE_LAW, "All creatures have protection from red.");

function mergeProtection(a: Protection, b: Protection): Protection {
  return {
    colors: [...new Set([...a.colors, ...b.colors])],
    fromEverything: a.fromEverything || b.fromEverything,
    other: [...new Set([...a.other, ...b.other])],
  };
}

const PROT_0_0 = parseProtection("protection from red");

export const ABSOLUTE_LAW_SCRIPT: CardScript = {
  oracleId: ABSOLUTE_LAW.oracleId,
  name: ABSOLUTE_LAW.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, _self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.types.includes("Creature"),
      modify: (chars) => {
        chars.protection = mergeProtection(chars.protection, PROT_0_0);
      },
    },
  ],
};
