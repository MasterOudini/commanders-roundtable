// `Avengers Hangar` — Land, "This land enters tapped.\nWhen this land enters,
// you gain 1 life.\n{T}: Add {W} or {U}." Asgardian Citadel's exact shape:
// D134's built-in owes the tap, the engine owes the mana, the script owes the
// trigger sentence. M6.4f, D163.

import { AVENGERS_HANGAR } from '../../../data/fixtures/engineCards';
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
  AVENGERS_HANGAR,
  'This land enters tapped.\nWhen this land enters, you gain 1 life.\n{T}: Add {W} or {U}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const AVENGERS_HANGAR_SCRIPT: CardScript = {
  oracleId: AVENGERS_HANGAR.oracleId,
  name: AVENGERS_HANGAR.name,
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
      label: () => 'Avengers Hangar — gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
