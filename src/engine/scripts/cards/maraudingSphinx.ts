// `Marauding Sphinx` - a youCommitCrime trigger scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARAUDING_SPHINX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MARAUDING_SPHINX, "Flying, vigilance, ward {2}\nWhenever you commit a crime, surveil 2. This ability triggers only once each turn. (Targeting opponents, anything they control, and/or cards in their graveyards is a crime.)");
const LINES = PRINTED.split('\n');

export const MARAUDING_SPHINX_SCRIPT: CardScript = {
  oracleId: MARAUDING_SPHINX.oracleId,
  name: MARAUDING_SPHINX.name,
  triggers: [
    {
      abilityId: 'youCommitCrime-1',
      text: LINES[1] as string,
      event: 'CrimeCommitted',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'CrimeCommitted' && ev.player === ctx.query.controllerOf(self),
      label: () => "Marauding Sphinx - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: true, thenDraw: 0, label: "Marauding Sphinx - surveil 2" } },
        ];
      },
    },
  ],
};
