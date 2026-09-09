// `Manriki-Gusari` - the permanent it is attached to HAS a quoted
// activated ability (D367's carrier): a layer-6 static installs it, and the def carrying that
// grant's ref resolves the quoted body through the engine's own effect vocabulary (D344).
// ⚠️ The RECIPIENT is the ability's source (CR 113.7a) - it taps, it pays, and "this creature"
// in the quoted body is the recipient, not this card. Generated from one table row.

import { MANRIKI_GUSARI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MANRIKI_GUSARI, "Equipped creature gets +1/+2 and has \"{T}: Destroy target Equipment.\"\nEquip {1} ({1}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

const GRANT = grantedActivated("{T}: Destroy target Equipment.", `${MANRIKI_GUSARI.oracleId}#g0`, MANRIKI_GUSARI.name);
const VOCAB = vocabularyEffects("Destroy target Equipment.", MANRIKI_GUSARI.name);
const VOCAB_T = vocabularyTargets("Destroy target Equipment.");

export const MANRIKI_GUSARI_SCRIPT: CardScript = {
  oracleId: MANRIKI_GUSARI.oracleId,
  name: MANRIKI_GUSARI.name,
  statics: [
    {
      abilityId: 'grant-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
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
