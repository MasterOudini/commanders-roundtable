// `Rainveil Rejuvenator` - a etb trigger mill
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAINVEIL_REJUVENATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAINVEIL_REJUVENATOR, "When this creature enters, you may mill three cards. (You may put the top three cards of your library into your graveyard.)\n{T}: Add an amount of {G} equal to this creature's power.");
const LINES = PRINTED.split('\n');

export const RAINVEIL_REJUVENATOR_SCRIPT: CardScript = {
  oracleId: RAINVEIL_REJUVENATOR.oracleId,
  name: RAINVEIL_REJUVENATOR.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Rainveil Rejuvenator - mill",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The top of a library is the END of the array (drawFromTop).
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const top = library.slice(Math.max(0, library.length - 3));
        if (top.length === 0) return [];
        return [{ t: 'CardsMoved', moves: top.map((card) => ({ card, from: { kind: 'library' as const, player: obj.controller }, to: { kind: 'graveyard' as const, player: obj.controller } })) }];
      },
    },
  ],
};
