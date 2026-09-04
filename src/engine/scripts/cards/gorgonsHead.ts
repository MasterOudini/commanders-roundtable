// `Gorgon's Head` - an Equipment: the equipped creature has deathtouch.
// The Equip line is the engine's own - a synthesized activated ability whose offer, charge
// and attach are the engine's (D305); the rest are defs whose one candidate is whatever
// the Equipment is attached to. Generated from one table row.

import { GORGON_S_HEAD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GORGON_S_HEAD, "Equipped creature has deathtouch.\nEquip {2}");
const LINES = PRINTED.split('\n');

export const GORGONS_HEAD_SCRIPT: CardScript = {
  oracleId: GORGON_S_HEAD.oracleId,
  name: GORGON_S_HEAD.name,
  statics: [
    {
      abilityId: 'equipped-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      // The one candidate: whatever the Equipment is attached to (nothing while it is not).
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("deathtouch");
      },
    },
  ],
};
