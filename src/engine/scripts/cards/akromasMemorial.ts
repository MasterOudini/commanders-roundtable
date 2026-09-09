// `Akroma's Memorial` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AKROMA_S_MEMORIAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AKROMA_S_MEMORIAL, "Creatures you control have flying, first strike, vigilance, trample, haste, and protection from black and from red.");

function mergeProtection(a: Protection, b: Protection): Protection {
  return {
    colors: [...new Set([...a.colors, ...b.colors])],
    fromEverything: a.fromEverything || b.fromEverything,
    other: [...new Set([...a.other, ...b.other])],
  };
}

const PROT_0_0 = parseProtection("protection from black and from red");

export const AKROMAS_MEMORIAL_SCRIPT: CardScript = {
  oracleId: AKROMA_S_MEMORIAL.oracleId,
  name: AKROMA_S_MEMORIAL.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("flying");
        chars.keywords.add("firstStrike");
        chars.keywords.add("vigilance");
        chars.keywords.add("trample");
        chars.keywords.add("haste");
        chars.protection = mergeProtection(chars.protection, PROT_0_0);
      },
    },
  ],
};
