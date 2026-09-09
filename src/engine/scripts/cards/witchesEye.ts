// `Witches' Eye` - the permanent it is attached to HAS a quoted
// activated ability (D367's carrier): a layer-6 static installs it, and the def carrying that
// grant's ref resolves the quoted body through the engine's own effect vocabulary (D344).
// ⚠️ The RECIPIENT is the ability's source (CR 113.7a) - it taps, it pays, and "this creature"
// in the quoted body is the recipient, not this card. Generated from one table row.

import { WITCHES_EYE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WITCHES_EYE, "Equipped creature has \"{1}, {T}: Scry 1.\" (To scry 1, look at the top card of your library, then you may put that card on the bottom.)\nEquip {1}");
const LINES = PRINTED.split('\n');

const GRANT = grantedActivated("{1}, {T}: Scry 1.", `${WITCHES_EYE.oracleId}#g0`, WITCHES_EYE.name);
const VOCAB = vocabularyEffects("Scry 1.", WITCHES_EYE.name);
const VOCAB_T = vocabularyTargets("Scry 1.");

export const WITCHES_EYE_SCRIPT: CardScript = {
  oracleId: WITCHES_EYE.oracleId,
  name: WITCHES_EYE.name,
  statics: [
    {
      abilityId: 'grant-0',
      text: LINES[0] as string,
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
      text: LINES[0] as string,
      granted: GRANT.ability,
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
