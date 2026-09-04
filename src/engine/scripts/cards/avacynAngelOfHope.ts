// `Avacyn, Angel of Hope` - a layer-6 grant: "Other permanents you control have indestructible". A StaticDef in the shape of the
// engine's Levitation (D129/D300): `appliesTo` reads the candidate's built characteristics,
// never derives it. Generated from one table row.

import { AVACYN_ANGEL_OF_HOPE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVACYN_ANGEL_OF_HOPE, "Flying, vigilance, indestructible\nOther permanents you control have indestructible.");
const TEXT = PRINTED.split('\n')[1] as string;

export const AVACYN_ANGEL_OF_HOPE_SCRIPT: CardScript = {
  oracleId: AVACYN_ANGEL_OF_HOPE.oracleId,
  name: AVACYN_ANGEL_OF_HOPE.name,
  statics: [
    {
      abilityId: 'grant',
      text: TEXT,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
        if (target.controller !== source.controller) return false;
        if (candidate === self) return false;
        return true;
      },
      modify: (chars) => {
        chars.keywords.add("indestructible");
      },
    },
  ],
};
