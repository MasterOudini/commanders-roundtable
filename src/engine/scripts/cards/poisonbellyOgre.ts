// `Poisonbelly Ogre` - "Whenever another creature enters, its controller loses 1
// life." - once PER creature (the bus's per-item mode, D185; `obj.item` is the
// creature), for cards and for tokens. Whole after D295's "its controller loses N
// life" sentence reading.

import { POISONBELLY_OGRE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { StackObject } from '../../types/state';

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

const TEXT = printed(POISONBELLY_OGRE, 'Whenever another creature enters, its controller loses 1 life.');

/** The entering creature rode the stack object as `obj.item`; its controller pays. */
function itsControllerLosesOne(ctx: ScriptCtx, obj: StackObject): readonly EventBody[] {
  const entered = obj.item ? ctx.state.cards[obj.item] : undefined;
  if (!entered) return [];
  const who = ctx.state.players[entered.controller];
  if (!who) return [];
  return [{ t: 'LifeChanged', player: entered.controller, delta: -1, to: who.life - 1 }];
}

export const POISONBELLY_OGRE_SCRIPT: CardScript = {
  oracleId: POISONBELLY_OGRE.oracleId,
  name: POISONBELLY_OGRE.name,
  triggers: [
    {
      abilityId: 'another-creature-enters',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (_ctx, _self, ev) => ev.t === 'CardsMoved',
      perItem: (ctx, self, ev) =>
        ev.t !== 'CardsMoved'
          ? []
          : ev.moves
              .filter((m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.derive(m.card).typeLine.types.includes('Creature'))
              .map((m) => m.card),
      label: () => 'Poisonbelly Ogre - its controller loses 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => itsControllerLosesOne(ctx, obj),
    },
    {
      abilityId: 'another-token-enters',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (_ctx, _self, ev) => ev.t === 'TokenCreated',
      perItem: (ctx, self, ev) => (ev.t === 'TokenCreated' && ev.card !== self && ctx.derive(ev.card).typeLine.types.includes('Creature') ? [ev.card] : []),
      label: () => 'Poisonbelly Ogre - its controller loses 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => itsControllerLosesOne(ctx, obj),
    },
  ],
};
