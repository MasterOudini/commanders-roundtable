// `Nurturing Presence` - a static attachedStatic, a creatureEnters trigger vocab, a etb trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NURTURING_PRESENCE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(NURTURING_PRESENCE, "Enchant creature\nEnchanted creature has \"Whenever a creature you control enters, this creature gets +1/+1 until end of turn.\"\nWhen this Aura enters, create a 1/1 white Spirit creature token with flying.");
const LINES = PRINTED.split('\n');
const TOKEN_L2 = tokenRef("Spirit|1/1|W|Creature|flying");

const VOCAB_L1 = vocabularyEffects("~ gets +1/+1 until end of turn.", NURTURING_PRESENCE.name);
const VOCAB_T_L1 = vocabularyTargets("~ gets +1/+1 until end of turn.");

const GRANT_1 = grantedTriggerRef(`${NURTURING_PRESENCE.oracleId}#gt1`, NURTURING_PRESENCE.name);

export const NURTURING_PRESENCE_SCRIPT: CardScript = {
  oracleId: NURTURING_PRESENCE.oracleId,
  name: NURTURING_PRESENCE.name,
  triggers: [
    {
      abilityId: 'gt1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Nurturing Presence - ~ gets +1/+1 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Nurturing Presence - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L2.oracleId,
          printingId: TOKEN_L2.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: GRANT_1 });
      },
    },
  ],
};
