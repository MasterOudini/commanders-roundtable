// `Phyrexian Vivisector` — "Whenever a creature you control dies,
// scry 1." The dies-watcher raising D195's ask; its OWN death counts
// ("a creature you control", not "another"). D233.

import { PHYREXIAN_VIVISECTOR } from '../../../data/fixtures/engineCards';
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
  PHYREXIAN_VIVISECTOR,
  'Whenever a creature you control dies, scry 1. (Look at the top card of your library. You may put that card on the bottom.)',
);

export const PHYREXIAN_VIVISECTOR_SCRIPT: CardScript = {
  oracleId: PHYREXIAN_VIVISECTOR.oracleId,
  name: PHYREXIAN_VIVISECTOR.name,
  triggers: [
    {
      abilityId: 'dies-scry',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          if (m.card === self) return true;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(m.card).typeLine.types.includes('Creature');
        }),
      label: () => 'Phyrexian Vivisector — scry 1',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count: n,
              toGraveyard: false,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
