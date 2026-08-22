// `Tasha's Hideous Laughter` — the first accumulate-until-a-BUDGET loop:
// each opponent exiles from the top of their library until the TOTAL mana
// value they have exiled reaches 20. The card that crosses the line is
// exiled too — the wording is "until that player HAS exiled cards with total
// mana value 20 or greater", so the run stops after the crossing card, not
// before it.
//
// ⚠️ A library card's mana value is read off the ORACLE (D171): there is no
// battlefield derivation to ask.

import { TASHA_S_HIDEOUS_LAUGHTER } from '../../../data/fixtures/engineCards';
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
  TASHA_S_HIDEOUS_LAUGHTER,
  'Each opponent exiles cards from the top of their library until that player has exiled cards with total mana value 20 or greater.',
);

export const TASHAS_HIDEOUS_LAUGHTER_SCRIPT: CardScript = {
  oracleId: TASHA_S_HIDEOUS_LAUGHTER.oracleId,
  name: TASHA_S_HIDEOUS_LAUGHTER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves: {
        card: InstanceId;
        from: { kind: 'library'; player: string };
        to: { kind: 'exile'; player: string };
      }[] = [];
      for (const pid of ctx.state.seating) {
        if (pid === obj.controller) continue;
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        const library = ctx.state.zones.library[pid] ?? [];
        let total = 0;
        for (let i = library.length - 1; i >= 0 && total < 20; i--) {
          const id = library[i] as InstanceId;
          const card = ctx.state.cards[id];
          if (!card) continue;
          const oc = ctx.oracle.byPrinting(card.printingId);
          total += oc?.manaValue ?? 0;
          moves.push({
            card: id,
            from: { kind: 'library', player: pid },
            to: { kind: 'exile', player: card.owner },
          });
        }
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
