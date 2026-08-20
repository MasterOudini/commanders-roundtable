// `Nefarious Imp` — "Whenever one or more permanents you control leave the
// battlefield, scry 1." The LEAVES watcher: the mover's controller is a
// fact about the board it LEFT, so the def looks back; the per-event batch
// is the printed "one or more". D228.

import { NEFARIOUS_IMP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  NEFARIOUS_IMP,
  'Flying\nWhenever one or more permanents you control leave the battlefield, scry 1. (Look at the top card of your library. You may put that card on the bottom.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const NEFARIOUS_IMP_SCRIPT: CardScript = {
  oracleId: NEFARIOUS_IMP.oracleId,
  name: NEFARIOUS_IMP.name,
  triggers: [
    {
      abilityId: 'leaves-scry',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        // The Imp's OWN exit counts too — "permanents you control" includes
        // it, and the looks-back zone check lets the dying Imp see itself go
        // (Brandywine Farmer's rule).
        ev.moves.some(
          (m) =>
            m.from.kind === 'battlefield' &&
            m.to.kind !== 'battlefield' &&
            ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self),
        ),
      label: () => 'Nefarious Imp — scry 1',
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
