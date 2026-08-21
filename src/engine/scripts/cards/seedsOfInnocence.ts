// `Seeds of Innocence` — "Destroy all artifacts. They can't be
// regenerated. The controller of each of those artifacts gains life
// equal to its mana value." The artifact wipe whose victims' controllers
// are PAID, per artifact, computed pre-move; the regeneration clause is
// vacuous and this file is a damnation-tripwire client (#17). D245.

import { SEEDS_OF_INNOCENCE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { PlayerId } from '../../types/ids';

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
  SEEDS_OF_INNOCENCE,
  "Destroy all artifacts. They can't be regenerated. The controller of each of those artifacts gains life equal to its mana value.",
);

export const SEEDS_OF_INNOCENCE_SCRIPT: CardScript = {
  oracleId: SEEDS_OF_INNOCENCE.oracleId,
  name: SEEDS_OF_INNOCENCE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      const gains = new Map<PlayerId, number>();
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Artifact')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
        const mv = ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0;
        gains.set(card.controller, (gains.get(card.controller) ?? 0) + mv);
      }
      if (moves.length === 0) return [];
      const events: EventBody[] = [{ t: 'CardsMoved', moves }];
      for (const [pid, gain] of gains) {
        const player = ctx.state.players[pid];
        if (!player || player.hasLost || gain <= 0) continue;
        events.push({ t: 'LifeChanged', player: pid, delta: gain, to: player.life + gain });
      }
      return events;
    },
  },
};
