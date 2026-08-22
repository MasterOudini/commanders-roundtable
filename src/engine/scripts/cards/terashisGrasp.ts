// `Terashi's Grasp` — the artifact-or-enchantment compound (D256's Sylvok
// Replica) with the gain read off the victim's MANA VALUE before the move,
// and the indestructible check that makes the two effects independent: a
// Darksteel artifact survives and pays NOTHING, because the life is "equal to
// its mana value" only for what this spell actually destroyed. D258.

import { TERASHI_S_GRASP } from '../../../data/fixtures/engineCards';
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
  TERASHI_S_GRASP,
  'Destroy target artifact or enchantment. You gain life equal to its mana value.',
);

export const TERASHIS_GRASP_SCRIPT: CardScript = {
  oracleId: TERASHI_S_GRASP.oracleId,
  name: TERASHI_S_GRASP.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      if (ctx.derive(target.id).keywords.has('indestructible')) return [];
      const oc = ctx.oracle.byPrinting(card.printingId);
      const mv = oc?.manaValue ?? 0;
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        },
      ];
      if (mv <= 0) return events;
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: mv, to: me.life + mv });
      }
      return events;
    },
  },
};
