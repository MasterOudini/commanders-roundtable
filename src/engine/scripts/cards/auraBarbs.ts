// `Aura Barbs` — "Each enchantment deals 2 damage to its controller, then
// each Aura attached to a creature deals 2 damage to the creature it's
// attached to." Two waves, each simultaneous in its own DamageDealt, each
// entry's SOURCE the enchantment itself so its own derived riders apply
// (Flamekin Spitfire's per-kind branch, D175). An Aura on a creature pays
// twice — once to its controller, once to its host — which is the card. D198.

import { AURA_BARBS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const TEXT = printed(
  AURA_BARBS,
  "Each enchantment deals 2 damage to its controller, then each Aura attached to a creature deals 2 damage to the creature it's attached to.",
);

export const AURA_BARBS_SCRIPT: CardScript = {
  oracleId: AURA_BARBS.oracleId,
  name: AURA_BARBS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const toControllers = [];
      const toHosts = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Enchantment')) continue;
        toControllers.push({
          source: id,
          target: { kind: 'player' as const, id: card.controller },
          amount: 2,
          deathtouch: d.keywords.has('deathtouch'),
          lifelinkTo: d.keywords.has('lifelink') ? card.controller : null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: d.toxicAmount,
          applyAs: d.keywords.has('infect') ? ('poison' as const) : ('normal' as const),
        });
        if (!d.typeLine.subtypes.includes('Aura')) continue;
        const host = card.attachedTo;
        if (!host) continue;
        const hostCard = ctx.state.cards[host];
        if (!hostCard || hostCard.zone.kind !== 'battlefield') continue;
        if (!ctx.derive(host).typeLine.types.includes('Creature')) continue;
        toHosts.push({
          source: id,
          target: { kind: 'card' as const, id: host },
          amount: 2,
          deathtouch: d.keywords.has('deathtouch'),
          lifelinkTo: d.keywords.has('lifelink') ? card.controller : null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: d.toxicAmount,
          applyAs:
            d.keywords.has('infect') || d.keywords.has('wither')
              ? ('wither' as const)
              : ('normal' as const),
        });
      }
      const events: EventBody[] = [];
      if (toControllers.length > 0) events.push({ t: 'DamageDealt', damages: toControllers });
      if (toHosts.length > 0) events.push({ t: 'DamageDealt', damages: toHosts });
      return events;
    },
  },
};
