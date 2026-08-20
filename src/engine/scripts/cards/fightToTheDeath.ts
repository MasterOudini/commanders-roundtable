// `Fight to the Death` — "Destroy all blocking creatures and all blocked
// creatures." Both sides read the COMBAT STATE: blockers are the declared
// blockers still standing, blocked attackers are the union of every
// blocker's attackerOrder. Cast in the post-blocks window. D213.

import { FIGHT_TO_THE_DEATH } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FIGHT_TO_THE_DEATH, 'Destroy all blocking creatures and all blocked creatures.');

export const FIGHT_TO_THE_DEATH_SCRIPT: CardScript = {
  oracleId: FIGHT_TO_THE_DEATH.oracleId,
  name: FIGHT_TO_THE_DEATH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const combat = ctx.state.combat;
      if (!combat) return [];
      const doomed = new Set<string>();
      for (const b of combat.blockers) {
        doomed.add(b.card);
        for (const a of b.attackerOrder) doomed.add(a);
      }
      const moves = [];
      for (const id of doomed) {
        const card = ctx.state.cards[id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        if (ctx.derive(id).keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
