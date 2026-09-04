// `Privileged Position` - a layer-6 grant: "Other permanents you control have hexproof. (They can't be the targets of spells or abilities your opponents control.)". A StaticDef in the shape of the
// engine's Levitation (D129/D300): `appliesTo` reads the candidate's built characteristics,
// never derives it. Generated from one table row.

import { PRIVILEGED_POSITION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PRIVILEGED_POSITION, "({G/W} can be paid with either {G} or {W}.)\nOther permanents you control have hexproof. (They can't be the targets of spells or abilities your opponents control.)");
const TEXT = PRINTED.split('\n')[1] as string;

export const PRIVILEGED_POSITION_SCRIPT: CardScript = {
  oracleId: PRIVILEGED_POSITION.oracleId,
  name: PRIVILEGED_POSITION.name,
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
        chars.keywords.add("hexproof");
      },
    },
  ],
};
