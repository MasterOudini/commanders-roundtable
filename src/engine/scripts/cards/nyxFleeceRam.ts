// `Nyx-Fleece Ram` — "At the beginning of your upkeep, you gain 1 life."
// The YOUR-upkeep gain (StepBegan + the active player is my controller).
// D229.

import { NYX_FLEECE_RAM } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(NYX_FLEECE_RAM, 'At the beginning of your upkeep, you gain 1 life.');

export const NYX_FLEECE_RAM_SCRIPT: CardScript = {
  oracleId: NYX_FLEECE_RAM.oracleId,
  name: NYX_FLEECE_RAM.name,
  triggers: [
    {
      abilityId: 'upkeep-gain',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' &&
        ev.step === 'upkeep' &&
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Nyx-Fleece Ram — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
