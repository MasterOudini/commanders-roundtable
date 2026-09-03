// `Sagittars' Volley` — destroy the targeted flyer, then 1 damage to every
// flyer my opponents control (the destroyed one is already gone). The
// targeting restriction is the parser's and the validator's (D289); the
// sweep reads DERIVED keywords, so a creature wearing flying is hit too.

import { SAGITTARS_VOLLEY } from '../../../data/fixtures/engineCards';
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
  SAGITTARS_VOLLEY,
  "Destroy target creature with flying. Sagittars' Volley deals 1 damage to each creature with flying your opponents control.",
);

export const SAGITTARS_VOLLEY_SCRIPT: CardScript = {
  oracleId: SAGITTARS_VOLLEY.oracleId,
  name: SAGITTARS_VOLLEY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [];
      const destroyed = !ctx.derive(target.id).keywords.has('indestructible');
      if (destroyed) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        if (destroyed && id === target.id) continue;
        const c = ctx.state.cards[id];
        if (!c || c.controller === obj.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.keywords.has('flying')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: 1,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      if (damages.length > 0) events.push({ t: 'DamageDealt', damages });
      return events;
    },
  },
};
