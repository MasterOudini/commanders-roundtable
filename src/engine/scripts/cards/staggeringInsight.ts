// `Staggering Insight` - the permanent it is attached to HAS a quoted
// TRIGGERED ability (D368's carrier): a layer-6 static installs the grant, and the def carrying
// that grant's ref fires off the RECIPIENT and resolves the payload through the vocabulary (D344).
// ⚠️ The RECIPIENT is the trigger's source (CR 113.7a) - "this creature" and "you" in the quoted
// body mean the recipient and its controller, not this card. Generated from one table row.

import { STAGGERING_INSIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STAGGERING_INSIGHT, "Enchant creature\nEnchanted creature gets +1/+1 and has lifelink and \"Whenever this creature deals combat damage to a player, draw a card.\"");
const LINES = PRINTED.split('\n');

const REF = grantedTriggerRef(`${STAGGERING_INSIGHT.oracleId}#gt1`, STAGGERING_INSIGHT.name);
const VOCAB = vocabularyEffects("draw a card.", STAGGERING_INSIGHT.name);
const VOCAB_T = vocabularyTargets("draw a card.");

export const STAGGERING_INSIGHT_SCRIPT: CardScript = {
  oracleId: STAGGERING_INSIGHT.oracleId,
  name: STAGGERING_INSIGHT.name,
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
        chars.keywords.add("lifelink");
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
      label: () => "Staggering Insight - draw a card.",
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
