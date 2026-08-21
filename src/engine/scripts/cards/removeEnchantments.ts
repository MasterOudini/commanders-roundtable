// `Remove Enchantments` — the six-clause partition, all deterministic:
// RETURN what is yours (enchantments you own and control; your Auras on
// your permanents; your Auras on attacking creatures your opponents
// control), then DESTROY the rest of the same scope. The scope is
// enchantments you control, plus Auras attached to your permanents,
// plus Auras attached to opponents' attackers — read off attachedTo and
// the combat state. D239.

import { REMOVE_ENCHANTMENTS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const TEXT = printed(
  REMOVE_ENCHANTMENTS,
  'Return to your hand all enchantments you both own and control, all Auras you own attached to permanents you control, and all Auras you own attached to attacking creatures your opponents control. ' +
    'Then destroy all other enchantments you control, all other Auras attached to permanents you control, and all other Auras attached to attacking creatures your opponents control.',
);

export const REMOVE_ENCHANTMENTS_SCRIPT: CardScript = {
  oracleId: REMOVE_ENCHANTMENTS.oracleId,
  name: REMOVE_ENCHANTMENTS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const mine = obj.controller;
      const attacking = new Set<InstanceId>(
        (ctx.state.combat?.attackers ?? []).map((a) => a.card),
      );
      const returns = [];
      const destroys = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Enchantment')) continue;
        const isAura = d.typeLine.subtypes.includes('Aura');
        const host = card.attachedTo ? ctx.state.cards[card.attachedTo] : null;
        const hostMine = host !== null && host !== undefined && host.controller === mine;
        const hostOppAttacking =
          host !== null &&
          host !== undefined &&
          host.controller !== mine &&
          card.attachedTo !== null &&
          attacking.has(card.attachedTo);
        const inScope = card.controller === mine || (isAura && (hostMine || hostOppAttacking));
        if (!inScope) continue;
        const returned =
          (card.owner === mine && card.controller === mine) ||
          (isAura && card.owner === mine && (hostMine || hostOppAttacking));
        if (returned) {
          returns.push({
            card: id,
            from: { kind: 'battlefield' as const, player: card.controller },
            to: { kind: 'hand' as const, player: card.owner },
          });
        } else if (!d.keywords.has('indestructible')) {
          destroys.push({
            card: id,
            from: { kind: 'battlefield' as const, player: card.controller },
            to: { kind: 'graveyard' as const, player: card.owner },
          });
        }
      }
      const events: EventBody[] = [];
      if (returns.length > 0) events.push({ t: 'CardsMoved', moves: returns });
      if (destroys.length > 0) events.push({ t: 'CardsMoved', moves: destroys });
      return events;
    },
  },
};
