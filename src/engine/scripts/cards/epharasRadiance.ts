// `Ephara's Radiance` - the permanent it is attached to HAS a quoted
// activated ability (D367's carrier): a layer-6 static installs it, and the def carrying that
// grant's ref resolves the quoted body through the engine's own effect vocabulary (D344).
// ⚠️ The RECIPIENT is the ability's source (CR 113.7a) - it taps, it pays, and "this creature"
// in the quoted body is the recipient, not this card. Generated from one table row.

import { EPHARA_S_RADIANCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EPHARA_S_RADIANCE, "Enchant creature\nEnchanted creature has \"{1}{W}, {T}: You gain 3 life.\"");
const LINES = PRINTED.split('\n');

const GRANT = grantedActivated("{1}{W}, {T}: You gain 3 life.", `${EPHARA_S_RADIANCE.oracleId}#g1`, EPHARA_S_RADIANCE.name);
const VOCAB = vocabularyEffects("You gain 3 life.", EPHARA_S_RADIANCE.name);
const VOCAB_T = vocabularyTargets("You gain 3 life.");

export const EPHARAS_RADIANCE_SCRIPT: CardScript = {
  oracleId: EPHARA_S_RADIANCE.oracleId,
  name: EPHARA_S_RADIANCE.name,
  statics: [
    {
      abilityId: 'grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT.ref, ability: GRANT.ability });
      },
    },
  ],
  activated: [
    {
      ref: GRANT.ref,
      text: LINES[1] as string,
      granted: GRANT.ability,
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
