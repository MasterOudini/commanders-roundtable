// `Take Flight` - the permanent it is attached to HAS a quoted
// TRIGGERED ability (D368's carrier): a layer-6 static installs the grant, and the def carrying
// that grant's ref fires off the RECIPIENT and resolves the payload through the vocabulary (D344).
// ⚠️ The RECIPIENT is the trigger's source (CR 113.7a) - "this creature" and "you" in the quoted
// body mean the recipient and its controller, not this card. Generated from one table row.

import { TAKE_FLIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TAKE_FLIGHT, "Enchant creature\nEnchanted creature gets +1/+0 and has flying and \"Whenever this creature attacks, draw a card.\"");
const LINES = PRINTED.split('\n');

const REF = grantedTriggerRef(`${TAKE_FLIGHT.oracleId}#gt1`, TAKE_FLIGHT.name);
const VOCAB = vocabularyEffects("draw a card.", TAKE_FLIGHT.name);
const VOCAB_T = vocabularyTargets("draw a card.");

export const TAKE_FLIGHT_SCRIPT: CardScript = {
  oracleId: TAKE_FLIGHT.oracleId,
  name: TAKE_FLIGHT.name,
  statics: [
    {
      abilityId: 'grant-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
    {
      abilityId: 'grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.keywords.add("flying");
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
      event: "AttackersDeclared",
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Take Flight - draw a card.",
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
