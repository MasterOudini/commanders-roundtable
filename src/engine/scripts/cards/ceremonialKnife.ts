// `Ceremonial Knife` - the permanent it is attached to HAS a quoted
// TRIGGERED ability whose body is about the RECIPIENT ITSELF (D384): a layer-6
// static installs the grant, and the def carrying that ref resolves the payload through the
// engine's own effect vocabulary (D344), which since D384 reads a SELF subject and aims it at
// the object's source - the recipient, never this card (CR 113.7a). Generated from one row.

import { CEREMONIAL_KNIFE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
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

const PRINTED = printed(CEREMONIAL_KNIFE, "Equipped creature gets +1/+0 and has \"Whenever this creature deals combat damage, create a Blood token.\" (It's an artifact with \"{1}, {T}, Discard a card, Sacrifice this token: Draw a card.\")\nEquip {2} ({2}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split("\n");

const REF = grantedTriggerRef(`${CEREMONIAL_KNIFE.oracleId}#gt0`, CEREMONIAL_KNIFE.name);
const VOCAB = vocabularyEffects("create a Blood token.", CEREMONIAL_KNIFE.name);
const VOCAB_T = vocabularyTargets("create a Blood token.");

export const CEREMONIAL_KNIFE_SCRIPT: CardScript = {
  oracleId: CEREMONIAL_KNIFE.oracleId,
  name: CEREMONIAL_KNIFE.name,
  statics: [
    {
      abilityId: 'grant-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
    {
      abilityId: 'grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: REF });
      },
    },
  ],
  triggers: [
    {
      // ⚠️ The abilityId MUST start with `gt`: that marker is how the registry indexes
      // this def as GRANTED, and that index is the bus's gate (D368).
      abilityId: 'gt0',
      text: LINES[0] as string,
      event: "CombatDamageDealt",
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.amount > 0),
      label: () => "Ceremonial Knife - create a Blood token.",
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
