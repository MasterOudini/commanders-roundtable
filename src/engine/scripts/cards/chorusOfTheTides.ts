// `Chorus of the Tides` - a heroic trigger scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHORUS_OF_THE_TIDES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHORUS_OF_THE_TIDES, "Flying\nHeroic — Whenever you cast a spell that targets this creature, scry 1. (To scry 1, look at the top card of your library, then you may put that card on the bottom.)");
const LINES = PRINTED.split('\n');

export const CHORUS_OF_THE_TIDES_SCRIPT: CardScript = {
  oracleId: CHORUS_OF_THE_TIDES.oracleId,
  name: CHORUS_OF_THE_TIDES.name,
  triggers: [
    {
      abilityId: 'heroic-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Chorus of the Tides - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Chorus of the Tides - scry 1" } },
        ];
      },
    },
  ],
};
