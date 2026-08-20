// `Lothlórien Lookout` — the attacks-scry: one line, no reminder. D222.

import { LOTHL_RIEN_LOOKOUT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(LOTHL_RIEN_LOOKOUT, 'Whenever this creature attacks, scry 1.');

export const LOTHLORIEN_LOOKOUT_SCRIPT: CardScript = {
  oracleId: LOTHL_RIEN_LOOKOUT.oracleId,
  name: LOTHL_RIEN_LOOKOUT.name,
  triggers: [
    {
      abilityId: 'attacks-scry',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Lothlórien Lookout — scry 1',
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
