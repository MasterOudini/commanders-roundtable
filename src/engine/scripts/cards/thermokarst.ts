// `Thermokarst` — the land destroy whose gain is conditioned on the SNOW
// supertype (Icequake's shape, D219). The supertype is read BEFORE the move,
// because a card in a graveyard has no battlefield derivation — and the gain
// is tied to what this spell actually destroyed, so an indestructible land
// survives and pays NOTHING (Terashi's Grasp's rule, D258). D259.

import { THERMOKARST } from '../../../data/fixtures/engineCards';
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
  THERMOKARST,
  'Destroy target land. If that land was a snow land, you gain 1 life.',
);

export const THERMOKARST_SCRIPT: CardScript = {
  oracleId: THERMOKARST.oracleId,
  name: THERMOKARST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      const d = ctx.derive(target.id);
      if (d.keywords.has('indestructible')) return [];
      // "was a snow land" — read while it is still on the battlefield.
      const snow = d.typeLine.supertypes.includes('Snow');
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
      if (!snow) return events;
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 });
      }
      return events;
    },
  },
};
