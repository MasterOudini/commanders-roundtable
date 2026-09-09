// `Spectral Sliver` - every permanent in its scope HAS a quoted
// ACTIVATED ability whose body is about the RECIPIENT ITSELF (D373): a layer-6
// static installs the grant, and the def carrying that ref resolves the payload through the
// engine's own effect vocabulary (D344), which since D373 reads a SELF subject and aims it at
// the object's source - the recipient, never this card (CR 113.7a). Generated from one row.

import { SPECTRAL_SLIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPECTRAL_SLIVER, "All Sliver creatures have \"{2}: This creature gets +1/+1 until end of turn.\"");

const GRANT = grantedActivated("{2}: This creature gets +1/+1 until end of turn.", `${SPECTRAL_SLIVER.oracleId}#g0`, SPECTRAL_SLIVER.name);
const VOCAB = vocabularyEffects("This creature gets +1/+1 until end of turn.", SPECTRAL_SLIVER.name);
const VOCAB_T = vocabularyTargets("This creature gets +1/+1 until end of turn.");

export const SPECTRAL_SLIVER_SCRIPT: CardScript = {
  oracleId: SPECTRAL_SLIVER.oracleId,
  name: SPECTRAL_SLIVER.name,
  statics: [
    {
      abilityId: 'grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, _self, _candidate, chars) => chars.typeLine.types.includes('Creature') && chars.typeLine.subtypes.includes("Sliver"),
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
