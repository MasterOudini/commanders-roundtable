// `Temple of Triumph` — the Temple cycle's scry land: enters tapped (D134's
// built-in), scries 1 on entry (this def), and adds {R} or {W} (the
// engine's own mana line). One printed shape across nine oracle ids —
// generated from the shipped Temple of Malice base (D196) so the ten are
// provably the same script. D257.

import { TEMPLE_OF_TRIUMPH } from '../../../data/fixtures/engineCards';
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
  TEMPLE_OF_TRIUMPH,
  'This land enters tapped.\nWhen this land enters, scry 1. (Look at the top card of your library. You may put that card on the bottom.)\n{T}: Add {R} or {W}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const TEMPLE_OF_TRIUMPH_SCRIPT: CardScript = {
  oracleId: TEMPLE_OF_TRIUMPH.oracleId,
  name: TEMPLE_OF_TRIUMPH.name,
  triggers: [
    {
      abilityId: 'etb-scry',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Temple of Triumph — scry 1',
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
