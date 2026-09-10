// `Flowering Field` - the permanent it is attached to HAS a quoted
// ACTIVATED ability whose body is about the RECIPIENT ITSELF (D384): a layer-6
// static installs the grant, and the def carrying that ref resolves the payload through the
// engine's own effect vocabulary (D344), which since D384 reads a SELF subject and aims it at
// the object's source - the recipient, never this card (CR 113.7a). Generated from one row.

import { FLOWERING_FIELD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLOWERING_FIELD, "Enchant land\nEnchanted land has \"{T}: Prevent the next 1 damage that would be dealt to any target this turn.\"");
const LINES = PRINTED.split("\n");

const GRANT = grantedActivated("{T}: Prevent the next 1 damage that would be dealt to any target this turn.", `${FLOWERING_FIELD.oracleId}#g1`, FLOWERING_FIELD.name);
const VOCAB = vocabularyEffects("Prevent the next 1 damage that would be dealt to any target this turn.", FLOWERING_FIELD.name);
const VOCAB_T = vocabularyTargets("Prevent the next 1 damage that would be dealt to any target this turn.");

export const FLOWERING_FIELD_SCRIPT: CardScript = {
  oracleId: FLOWERING_FIELD.oracleId,
  name: FLOWERING_FIELD.name,
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
