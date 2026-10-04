// `Courser of Kruphix` - a static topOfLibrary, a static topOfLibrary, a landfall trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COURSER_OF_KRUPHIX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COURSER_OF_KRUPHIX, "Play with the top card of your library revealed.\nYou may play lands from the top of your library.\nLandfall — Whenever a land you control enters, you gain 1 life.");
const LINES = PRINTED.split('\n');

export const COURSER_OF_KRUPHIX_SCRIPT: CardScript = {
  oracleId: COURSER_OF_KRUPHIX.oracleId,
  name: COURSER_OF_KRUPHIX.name,
  triggers: [
    {
      abilityId: 'landfall-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Courser of Kruphix - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
  ],
  topOfLibrary: [
    { abilityId: "top-0", text: LINES[0] as string, revealed: true },
    { abilityId: "top-1", text: LINES[1] as string, lands: true },
  ],
};
