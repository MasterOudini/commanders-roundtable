// `Basilisk Collar` - an Equipment: the equipped creature has deathtouch, lifelink.
// The Equip line is the engine's own - a synthesized activated ability whose offer, charge
// and attach are the engine's (D305); the rest are defs whose one candidate is whatever
// the Equipment is attached to. Generated from one table row.

import { BASILISK_COLLAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BASILISK_COLLAR, "Equipped creature has deathtouch and lifelink. (Any amount of damage it deals to a creature is enough to destroy it. Damage dealt by this creature also causes you to gain that much life.)\nEquip {2} ({2}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const BASILISK_COLLAR_SCRIPT: CardScript = {
  oracleId: BASILISK_COLLAR.oracleId,
  name: BASILISK_COLLAR.name,
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
        chars.keywords.add("lifelink");
      },
    },
  ],
};
