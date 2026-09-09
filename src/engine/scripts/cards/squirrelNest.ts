// `Squirrel Nest` - the permanent it is attached to HAS a quoted
// activated ability (D367's carrier): a layer-6 static installs it, and the def carrying that
// grant's ref resolves the quoted body through the engine's own effect vocabulary (D344).
// ⚠️ The RECIPIENT is the ability's source (CR 113.7a) - it taps, it pays, and "this creature"
// in the quoted body is the recipient, not this card. Generated from one table row.

import { SQUIRREL_NEST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SQUIRREL_NEST, "Enchant land\nEnchanted land has \"{T}: Create a 1/1 green Squirrel creature token.\"");
const LINES = PRINTED.split('\n');

const GRANT = grantedActivated("{T}: Create a 1/1 green Squirrel creature token.", `${SQUIRREL_NEST.oracleId}#g1`, SQUIRREL_NEST.name);
const VOCAB = vocabularyEffects("Create a 1/1 green Squirrel creature token.", SQUIRREL_NEST.name);
const VOCAB_T = vocabularyTargets("Create a 1/1 green Squirrel creature token.");

export const SQUIRREL_NEST_SCRIPT: CardScript = {
  oracleId: SQUIRREL_NEST.oracleId,
  name: SQUIRREL_NEST.name,
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
