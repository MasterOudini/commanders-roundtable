// `Shadowy Backstreet` — the surveil land with the reminder-FIRST line
// order (TEXT = split[2], Raucous Theater's family): the typed dual's
// mana is a reminder, the tapped entry is the built-in, the def claims
// the ETB surveil. D246.

import { SHADOWY_BACKSTREET } from '../../../data/fixtures/engineCards';
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
  SHADOWY_BACKSTREET,
  '({T}: Add {W} or {B}.)\nThis land enters tapped.\nWhen this land enters, surveil 1. ' +
    '(Look at the top card of your library. You may put it into your graveyard.)',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const SHADOWY_BACKSTREET_SCRIPT: CardScript = {
  oracleId: SHADOWY_BACKSTREET.oracleId,
  name: SHADOWY_BACKSTREET.name,
  triggers: [
    {
      abilityId: 'etb-surveil',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Shadowy Backstreet — surveil 1',
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
              toGraveyard: true,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
