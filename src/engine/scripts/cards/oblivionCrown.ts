// `Oblivion Crown` - the permanent it is attached to HAS a quoted
// ACTIVATED ability whose body is about the RECIPIENT ITSELF (D373): a layer-6
// static installs the grant, and the def carrying that ref resolves the payload through the
// engine's own effect vocabulary (D344), which since D373 reads a SELF subject and aims it at
// the object's source - the recipient, never this card (CR 113.7a). Generated from one row.

import { OBLIVION_CROWN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OBLIVION_CROWN, "Flash (You may cast this spell any time you could cast an instant.)\nEnchant creature\nEnchanted creature has \"Discard a card: This creature gets +1/+1 until end of turn.\"");
const LINES = PRINTED.split("\n");

const GRANT = grantedActivated("Discard a card: This creature gets +1/+1 until end of turn.", `${OBLIVION_CROWN.oracleId}#g2`, OBLIVION_CROWN.name);
const VOCAB = vocabularyEffects("This creature gets +1/+1 until end of turn.", OBLIVION_CROWN.name);
const VOCAB_T = vocabularyTargets("This creature gets +1/+1 until end of turn.");

export const OBLIVION_CROWN_SCRIPT: CardScript = {
  oracleId: OBLIVION_CROWN.oracleId,
  name: OBLIVION_CROWN.name,
  statics: [
    {
      abilityId: 'grant-2',
      text: LINES[2] as string,
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
      text: LINES[2] as string,
      granted: GRANT.ability,
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
