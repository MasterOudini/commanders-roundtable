// `Contemplation` — "Whenever you cast a spell, you gain 1 life." Talrand's
// cast-watcher with NO type filter: every spell its controller casts pays a
// life. M6.4l, D169.

import { CONTEMPLATION } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CONTEMPLATION, 'Whenever you cast a spell, you gain 1 life.');

export const CONTEMPLATION_SCRIPT: CardScript = {
  oracleId: CONTEMPLATION.oracleId,
  name: CONTEMPLATION.name,
  triggers: [
    {
      abilityId: 'cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      // "you cast" — the SPELL's controller, never the active player.
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self),
      label: () => 'Contemplation — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
