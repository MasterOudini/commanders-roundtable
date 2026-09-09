// `Acidic Sliver` - every permanent in its scope HAS a quoted
// activated ability (D367's carrier): a layer-6 static installs it, and the def carrying that
// grant's ref resolves the quoted body through the engine's own effect vocabulary (D344).
// ⚠️ The RECIPIENT is the ability's source (CR 113.7a) - it taps, it pays, and "this creature"
// in the quoted body is the recipient, not this card. Generated from one table row.

import { ACIDIC_SLIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ACIDIC_SLIVER, "All Slivers have \"{2}, Sacrifice this permanent: This permanent deals 2 damage to any target.\"");

const GRANT = grantedActivated("{2}, Sacrifice this permanent: This permanent deals 2 damage to any target.", `${ACIDIC_SLIVER.oracleId}#g0`, ACIDIC_SLIVER.name);
const VOCAB = vocabularyEffects("This permanent deals 2 damage to any target.", ACIDIC_SLIVER.name);
const VOCAB_T = vocabularyTargets("This permanent deals 2 damage to any target.");

export const ACIDIC_SLIVER_SCRIPT: CardScript = {
  oracleId: ACIDIC_SLIVER.oracleId,
  name: ACIDIC_SLIVER.name,
  statics: [
    {
      abilityId: 'grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, _self, _candidate, chars) => chars.typeLine.subtypes.includes("Sliver"),
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
