// `Profane Memento` — "Whenever a creature card is put into an
// opponent's graveyard from anywhere, you gain 1 life." The THIRD
// perItem consumer (D190): a wipe filling an opponent's graveyard with
// three creatures pays three, one firing per card. The mover is typed
// off the ORACLE face — a graveyard arrival has no battlefield
// derivation — and the predicate is written inline twice (D178's rule
// for shapes shared across matches and perItem). D235.

import { PROFANE_MEMENTO } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  PROFANE_MEMENTO,
  "Whenever a creature card is put into an opponent's graveyard from anywhere, you gain 1 life.",
);

export const PROFANE_MEMENTO_SCRIPT: CardScript = {
  oracleId: PROFANE_MEMENTO.oracleId,
  name: PROFANE_MEMENTO.name,
  triggers: [
    {
      abilityId: 'grave-gain',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.to.kind !== 'graveyard') return false;
          if (m.to.player === ctx.query.controllerOf(self)) return false;
          const inst = ctx.state.cards[m.card];
          const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
          if (!oc) return false;
          return faceOf(oc, inst?.faceIndex ?? 0).typeLine.types.includes('Creature');
        }),
      // One firing PER creature card arriving (the printed rule is per
      // card, and a wipe batches every death into one event).
      perItem: (ctx, self, ev) =>
        ev.t === 'CardsMoved'
          ? ev.moves
              .filter((m) => {
                if (m.to.kind !== 'graveyard') return false;
                if (m.to.player === ctx.query.controllerOf(self)) return false;
                const inst = ctx.state.cards[m.card];
                const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
                if (!oc) return false;
                return faceOf(oc, inst?.faceIndex ?? 0).typeLine.types.includes('Creature');
              })
              .map((m) => m.card)
          : [],
      label: () => 'Profane Memento — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
