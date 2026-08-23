// `Virulent Emissary` — deathtouch plus Soul Warden's 'another' entry watcher
// (D158): TWO defs, because a token enters via `TokenCreated` and a card via
// `CardsMoved`, and the bus dispatches on exact event kind. The keyword line
// never counts, so the def's text is `split[1]`. D266.

import { VIRULENT_EMISSARY } from '../../../data/fixtures/engineCards';
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
  VIRULENT_EMISSARY,
  'Deathtouch\nWhenever another creature you control enters, you gain 1 life.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const VIRULENT_EMISSARY_SCRIPT: CardScript = {
  oracleId: VIRULENT_EMISSARY.oracleId,
  name: VIRULENT_EMISSARY.name,
  triggers: [
    {
      abilityId: 'creature-card-enters',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.moves.some((m) => {
          if (m.card === self) return false; // "another"
          if (m.to.kind !== 'battlefield' || m.from.kind === 'battlefield') return false;
          if (m.to.player !== mine) return false;
          return ctx.derive(m.card).typeLine.types.includes('Creature');
        });
      },
      label: () => 'Virulent Emissary — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
    {
      abilityId: 'creature-token-enters',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'TokenCreated') return false;
        if (ev.card === self) return false;
        if (ev.controller !== ctx.query.controllerOf(self)) return false;
        return ctx.derive(ev.card).typeLine.types.includes('Creature');
      },
      label: () => 'Virulent Emissary — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
