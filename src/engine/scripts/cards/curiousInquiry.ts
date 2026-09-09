// `Curious Inquiry` - the permanent it is attached to HAS a quoted
// TRIGGERED ability whose body is about the RECIPIENT ITSELF (D373): a layer-6
// static installs the grant, and the def carrying that ref resolves the payload through the
// engine's own effect vocabulary (D344), which since D373 reads a SELF subject and aims it at
// the object's source - the recipient, never this card (CR 113.7a). Generated from one row.

import { CURIOUS_INQUIRY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CURIOUS_INQUIRY, "Enchant creature\nEnchanted creature gets +1/+1 and has \"Whenever this creature deals combat damage to a player, investigate.\" (Create a Clue token. It's an artifact with \"{2}, Sacrifice this token: Draw a card.\")");
const LINES = PRINTED.split("\n");

const REF = grantedTriggerRef(`${CURIOUS_INQUIRY.oracleId}#gt1`, CURIOUS_INQUIRY.name);
const VOCAB = vocabularyEffects("investigate.", CURIOUS_INQUIRY.name);
const VOCAB_T = vocabularyTargets("investigate.");

export const CURIOUS_INQUIRY_SCRIPT: CardScript = {
  oracleId: CURIOUS_INQUIRY.oracleId,
  name: CURIOUS_INQUIRY.name,
  statics: [
    {
      abilityId: 'grant-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'grant-1',
      text: LINES[1] as string,
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
      abilityId: 'gt1',
      text: LINES[1] as string,
      event: "CombatDamageDealt",
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Curious Inquiry - investigate.",
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
