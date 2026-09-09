// `Creeping Crystal Coating` - the permanent it is attached to HAS a quoted
// TRIGGERED ability (D368's carrier): a layer-6 static installs the grant, and the def carrying
// that grant's ref fires off the RECIPIENT and resolves the payload through the vocabulary (D344).
// ⚠️ The RECIPIENT is the trigger's source (CR 113.7a) - "this creature" and "you" in the quoted
// body mean the recipient and its controller, not this card. Generated from one table row.

import { CREEPING_CRYSTAL_COATING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CREEPING_CRYSTAL_COATING, "Flash\nEnchant creature\nEnchanted creature gets +0/+3 and has \"Whenever this creature attacks, create a Food token.\" (It's an artifact with \"{2}, {T}, Sacrifice this token: You gain 3 life.\")");
const LINES = PRINTED.split('\n');

const REF = grantedTriggerRef(`${CREEPING_CRYSTAL_COATING.oracleId}#gt2`, CREEPING_CRYSTAL_COATING.name);
const VOCAB = vocabularyEffects("create a Food token.", CREEPING_CRYSTAL_COATING.name);
const VOCAB_T = vocabularyTargets("create a Food token.");

export const CREEPING_CRYSTAL_COATING_SCRIPT: CardScript = {
  oracleId: CREEPING_CRYSTAL_COATING.oracleId,
  name: CREEPING_CRYSTAL_COATING.name,
  statics: [
    {
      abilityId: 'grant-pt-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 0;
        if (chars.toughness !== null) chars.toughness += 3;
      },
    },
    {
      abilityId: 'grant-2',
      text: LINES[2] as string,
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
      abilityId: 'gt2',
      text: LINES[2] as string,
      event: "AttackersDeclared",
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Creeping Crystal Coating - create a Food token.",
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
