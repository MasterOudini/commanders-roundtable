// `Commander's Authority` - the permanent it is attached to HAS a quoted
// TRIGGERED ability (D368's carrier): a layer-6 static installs the grant, and the def carrying
// that grant's ref fires off the RECIPIENT and resolves the payload through the vocabulary (D344).
// ⚠️ The RECIPIENT is the trigger's source (CR 113.7a) - "this creature" and "you" in the quoted
// body mean the recipient and its controller, not this card. Generated from one table row.

import { COMMANDER_S_AUTHORITY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COMMANDER_S_AUTHORITY, "Enchant creature\nEnchanted creature has \"At the beginning of your upkeep, create a 1/1 white Human creature token.\"");
const LINES = PRINTED.split('\n');

const REF = grantedTriggerRef(`${COMMANDER_S_AUTHORITY.oracleId}#gt1`, COMMANDER_S_AUTHORITY.name);
const VOCAB = vocabularyEffects("create a 1/1 white Human creature token.", COMMANDER_S_AUTHORITY.name);
const VOCAB_T = vocabularyTargets("create a 1/1 white Human creature token.");

export const COMMANDERS_AUTHORITY_SCRIPT: CardScript = {
  oracleId: COMMANDER_S_AUTHORITY.oracleId,
  name: COMMANDER_S_AUTHORITY.name,
  statics: [
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
      event: "StepBegan",
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Commander's Authority - create a 1/1 white Human creature token.",
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
