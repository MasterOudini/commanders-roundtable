// `Kaya's Wrath` — the wipe pays its caster for their OWN losses only
// (Fumigate's own-kill count on its Orzhov twin). D221.

import { KAYA_S_WRATH } from '../../../data/fixtures/engineCards';
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
  KAYA_S_WRATH,
  'Destroy all creatures. You gain life equal to the number of creatures you controlled that were destroyed this way.',
);

export const KAYAS_WRATH_SCRIPT: CardScript = {
  oracleId: KAYA_S_WRATH.oracleId,
  name: KAYA_S_WRATH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      let mine = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.keywords.has('indestructible')) continue;
        if (card.controller === obj.controller) mine++;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      const events: EventBody[] = [];
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      const me = ctx.state.players[obj.controller];
      if (mine > 0 && me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: mine, to: me.life + mine });
      }
      return events;
    },
  },
};
