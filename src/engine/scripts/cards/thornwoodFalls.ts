// `Thornwood Falls` — the refuge (Fisk Tower's shape, D175): enters tapped
// (D134's built-in), gains 1 on entry (this def), and adds {G} or {U} (the
// engine's mana line). D259.

import { THORNWOOD_FALLS } from '../../../data/fixtures/engineCards';
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
  THORNWOOD_FALLS,
  'This land enters tapped.\nWhen this land enters, you gain 1 life.\n{T}: Add {G} or {U}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const THORNWOOD_FALLS_SCRIPT: CardScript = {
  oracleId: THORNWOOD_FALLS.oracleId,
  name: THORNWOOD_FALLS.name,
  triggers: [
    {
      abilityId: 'etb-gain',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Thornwood Falls — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
