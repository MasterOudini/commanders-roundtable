// `Hollowhead Sliver` - every permanent in its scope HAS a quoted
// activated ability (D367's carrier): a layer-6 static installs it, and the def carrying that
// grant's ref resolves the quoted body through the engine's own effect vocabulary (D344).
// ⚠️ The RECIPIENT is the ability's source (CR 113.7a) - it taps, it pays, and "this creature"
// in the quoted body is the recipient, not this card. Generated from one table row.

import { HOLLOWHEAD_SLIVER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedActivated } from '../grants';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(HOLLOWHEAD_SLIVER, "Sliver creatures you control have \"{T}, Discard a card: Draw a card.\"");

const GRANT = grantedActivated("{T}, Discard a card: Draw a card.", `${HOLLOWHEAD_SLIVER.oracleId}#g0`, HOLLOWHEAD_SLIVER.name);
const VOCAB = vocabularyEffects("Draw a card.", HOLLOWHEAD_SLIVER.name);
const VOCAB_T = vocabularyTargets("Draw a card.");

export const HOLLOWHEAD_SLIVER_SCRIPT: CardScript = {
  oracleId: HOLLOWHEAD_SLIVER.oracleId,
  name: HOLLOWHEAD_SLIVER.name,
  statics: [
    {
      abilityId: 'grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && chars.typeLine.subtypes.includes("Sliver") && ctx.query.controllerOf(candidate) === ctx.query.controllerOf(self),
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT.ref, ability: GRANT.ability });
      },
    },
  ],
  activated: [
    {
      ref: GRANT.ref,
      text: PRINTED,
      granted: GRANT.ability,
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
