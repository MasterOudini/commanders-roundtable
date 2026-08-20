// `Geist of the Archives` — defender (Tier 2) plus "At the beginning of
// your upkeep, scry 1." Celestial Force's upkeep event with the
// YOUR-upkeep filter, raising the D195 ask. D215.

import { GEIST_OF_THE_ARCHIVES } from '../../../data/fixtures/engineCards';
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
  GEIST_OF_THE_ARCHIVES,
  'Defender\nAt the beginning of your upkeep, scry 1. (Look at the top card of your library. You may put that card on the bottom.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const GEIST_OF_THE_ARCHIVES_SCRIPT: CardScript = {
  oracleId: GEIST_OF_THE_ARCHIVES.oracleId,
  name: GEIST_OF_THE_ARCHIVES.name,
  triggers: [
    {
      abilityId: 'upkeep-scry',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' &&
        ev.step === 'upkeep' &&
        ctx.state.turn.activePlayer === ctx.state.cards[self]?.controller,
      label: () => 'Geist of the Archives — scry 1',
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
