// `Consuming Fervor` - the permanent it is attached to HAS a quoted
// TRIGGERED ability whose body is about the RECIPIENT ITSELF (D373): a layer-6
// static installs the grant, and the def carrying that ref resolves the payload through the
// engine's own effect vocabulary (D344), which since D373 reads a SELF subject and aims it at
// the object's source - the recipient, never this card (CR 113.7a). Generated from one row.

import { CONSUMING_FERVOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CONSUMING_FERVOR, "Enchant creature\nEnchanted creature gets +3/+3 and has \"At the beginning of your upkeep, put a -1/-1 counter on this creature.\"");
const LINES = PRINTED.split("\n");

const REF = grantedTriggerRef(`${CONSUMING_FERVOR.oracleId}#gt1`, CONSUMING_FERVOR.name);
const VOCAB = vocabularyEffects("put a -1/-1 counter on this creature.", CONSUMING_FERVOR.name);
const VOCAB_T = vocabularyTargets("put a -1/-1 counter on this creature.");

export const CONSUMING_FERVOR_SCRIPT: CardScript = {
  oracleId: CONSUMING_FERVOR.oracleId,
  name: CONSUMING_FERVOR.name,
  statics: [
    {
      abilityId: 'grant-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 3;
        if (chars.toughness !== null) chars.toughness += 3;
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
      event: "StepBegan",
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Consuming Fervor - put a -1/-1 counter on this creature.",
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
