// `Filigree Familiar` — "When this creature enters, you gain 2 life.\nWhen
// this creature dies, draw a card." Circuit Mender's shape (D274) with a
// DIES watcher in place of the leaves watcher: looks back (CR 603.10a), and
// only a graveyard destination pays — a bounce does not. D275.

import { FILIGREE_FAMILIAR } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  FILIGREE_FAMILIAR,
  'When this creature enters, you gain 2 life.\nWhen this creature dies, draw a card.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const DIES = PRINTED.split('\n')[1] as string;

export const FILIGREE_FAMILIAR_SCRIPT: CardScript = {
  oracleId: FILIGREE_FAMILIAR.oracleId,
  name: FILIGREE_FAMILIAR.name,
  triggers: [
    {
      abilityId: 'enters',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Filigree Familiar — you gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
    {
      abilityId: 'dies',
      text: DIES,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => 'Filigree Familiar — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
