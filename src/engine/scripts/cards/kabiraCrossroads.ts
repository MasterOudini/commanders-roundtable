// `Kabira Crossroads` — Land, "This land enters tapped.\nWhen this land
// enters, you gain 2 life.\n{T}: Add {W}." The Fisk Tower shape on a
// mono-coloured line, paying 2. M6.4aa, D183.

import { KABIRA_CROSSROADS } from '../../../data/fixtures/engineCards';
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
  KABIRA_CROSSROADS,
  'This land enters tapped.\nWhen this land enters, you gain 2 life.\n{T}: Add {W}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const KABIRA_CROSSROADS_SCRIPT: CardScript = {
  oracleId: KABIRA_CROSSROADS.oracleId,
  name: KABIRA_CROSSROADS.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Kabira Crossroads — gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 }];
      },
    },
  ],
};
