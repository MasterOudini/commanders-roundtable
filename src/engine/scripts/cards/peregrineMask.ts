// `Peregrine Mask` - an Equipment: the equipped creature has defender, flying, firstStrike.
// The Equip line is the engine's own - a synthesized activated ability whose offer, charge
// and attach are the engine's (D305); the rest are defs whose one candidate is whatever
// the Equipment is attached to. Generated from one table row.

import { PEREGRINE_MASK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PEREGRINE_MASK, "Equipped creature has defender, flying, and first strike.\nEquip {2}");
const LINES = PRINTED.split('\n');

export const PEREGRINE_MASK_SCRIPT: CardScript = {
  oracleId: PEREGRINE_MASK.oracleId,
  name: PEREGRINE_MASK.name,
  statics: [
    {
      abilityId: 'equipped-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      // The one candidate: whatever the Equipment is attached to (nothing while it is not).
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("defender");
        chars.keywords.add("flying");
        chars.keywords.add("firstStrike");
      },
    },
  ],
};
