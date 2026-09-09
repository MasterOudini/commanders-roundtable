// `Thorncaster Sliver` - every permanent in its scope HAS a quoted
// TRIGGERED ability whose body is about the RECIPIENT ITSELF (D373): a layer-6
// static installs the grant, and the def carrying that ref resolves the payload through the
// engine's own effect vocabulary (D344), which since D373 reads a SELF subject and aims it at
// the object's source - the recipient, never this card (CR 113.7a). Generated from one row.

import { THORNCASTER_SLIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THORNCASTER_SLIVER, "Sliver creatures you control have \"Whenever this creature attacks, it deals 1 damage to any target.\"");

const REF = grantedTriggerRef(`${THORNCASTER_SLIVER.oracleId}#gt0`, THORNCASTER_SLIVER.name);
const VOCAB = vocabularyEffects("it deals 1 damage to any target.", THORNCASTER_SLIVER.name);
const VOCAB_T = vocabularyTargets("it deals 1 damage to any target.");

export const THORNCASTER_SLIVER_SCRIPT: CardScript = {
  oracleId: THORNCASTER_SLIVER.oracleId,
  name: THORNCASTER_SLIVER.name,
  statics: [
    {
      abilityId: 'grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && chars.typeLine.subtypes.includes("Sliver") && ctx.query.controllerOf(candidate) === ctx.query.controllerOf(self),
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
      text: PRINTED,
      event: "AttackersDeclared",
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Thorncaster Sliver - it deals 1 damage to any target.",
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
