// `Spined Megalodon` — the attacks-scry behind a hexproof line (TEXT =
// split[1]). D251.

import { SPINED_MEGALODON } from '../../../data/fixtures/engineCards';
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
  SPINED_MEGALODON,
  "Hexproof (This creature can't be the target of spells or abilities your opponents control.)\n" +
    'Whenever this creature attacks, scry 1. (Look at the top card of your library. You may put that card on the bottom.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SPINED_MEGALODON_SCRIPT: CardScript = {
  oracleId: SPINED_MEGALODON.oracleId,
  name: SPINED_MEGALODON.name,
  triggers: [
    {
      abilityId: 'attacks-scry',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Spined Megalodon — scry 1',
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
