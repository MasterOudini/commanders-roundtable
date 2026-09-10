// `Eternal Thirst` - the permanent it is attached to HAS a quoted
// TRIGGERED ability whose body is about the RECIPIENT ITSELF (D384): a layer-6
// static installs the grant, and the def carrying that ref resolves the payload through the
// engine's own effect vocabulary (D344), which since D384 reads a SELF subject and aims it at
// the object's source - the recipient, never this card (CR 113.7a). Generated from one row.

import { ETERNAL_THIRST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ETERNAL_THIRST, "Enchant creature\nEnchanted creature has lifelink and \"Whenever a creature an opponent controls dies, put a +1/+1 counter on this creature.\" (Damage dealt by a creature with lifelink also causes its controller to gain that much life.)");
const LINES = PRINTED.split("\n");

const REF = grantedTriggerRef(`${ETERNAL_THIRST.oracleId}#gt1`, ETERNAL_THIRST.name);
const VOCAB = vocabularyEffects("put a +1/+1 counter on this creature.", ETERNAL_THIRST.name);
const VOCAB_T = vocabularyTargets("put a +1/+1 counter on this creature.");

export const ETERNAL_THIRST_SCRIPT: CardScript = {
  oracleId: ETERNAL_THIRST.oracleId,
  name: ETERNAL_THIRST.name,
  statics: [
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
      event: "CardsMoved",
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller !== ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Eternal Thirst - put a +1/+1 counter on this creature.",
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
