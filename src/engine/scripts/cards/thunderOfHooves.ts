// `Thunder of Hooves` — X censused off BEASTS ON THE BATTLEFIELD (everyone's,
// not just mine), fanned at every creature WITHOUT flying and at every player.
// Earthquake's flying exemption (D210) with a board census for X. D260.

import { THUNDER_OF_HOOVES } from '../../../data/fixtures/engineCards';
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
  THUNDER_OF_HOOVES,
  'Thunder of Hooves deals X damage to each creature without flying and each player, where X is the number of Beasts on the battlefield.',
);

export const THUNDER_OF_HOOVES_SCRIPT: CardScript = {
  oracleId: THUNDER_OF_HOOVES.oracleId,
  name: THUNDER_OF_HOOVES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self): readonly EventBody[] => {
      // "on the battlefield" — every Beast, whoever controls it.
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Beast')) x += 1;
      }
      if (x === 0) return [];
      const hit = (target: { kind: 'card'; id: string } | { kind: 'player'; id: string }) => ({
        source: self,
        target,
        amount: x,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.keywords.has('flying')) continue;
        damages.push(hit({ kind: 'card', id }));
      }
      for (const pid of ctx.state.seating) {
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        damages.push(hit({ kind: 'player', id: pid }));
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
