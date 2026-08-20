// `Chandra's Fury` — "Chandra's Fury deals 4 damage to target player or
// planeswalker and 1 damage to each creature that player or that
// planeswalker's controller controls." The rider's owner is the player
// half OR the planeswalker's controller. D203.

import { CHANDRA_S_FURY } from '../../../data/fixtures/engineCards';
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
  CHANDRA_S_FURY,
  "Chandra's Fury deals 4 damage to target player or planeswalker and 1 damage to each creature that player or that planeswalker's controller controls.",
);

export const CHANDRAS_FURY_SCRIPT: CardScript = {
  oracleId: CHANDRA_S_FURY.oracleId,
  name: CHANDRA_S_FURY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target) return [];
      if (target.kind === 'stack') return [];
      let who: string | null = null;
      const hit = (
        to: { kind: 'card'; id: string } | { kind: 'player'; id: string },
        amount: number,
      ) => ({
        source: self,
        target: to,
        amount,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      const damages = [];
      if (target.kind === 'player') {
        who = target.id;
        damages.push(hit({ kind: 'player', id: target.id }, 4));
      } else {
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        who = card.controller;
        damages.push(hit({ kind: 'card', id: target.id }, 4));
      }
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== who) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        damages.push(hit({ kind: 'card', id }, 1));
      }
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
