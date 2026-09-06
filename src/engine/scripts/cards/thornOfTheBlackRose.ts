// `Thorn of the Black Rose` - a etb trigger monarch
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THORN_OF_THE_BLACK_ROSE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { n, narrated, vb, who } from '../../narrate';

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

const PRINTED = printed(THORN_OF_THE_BLACK_ROSE, "Deathtouch\nWhen this creature enters, you become the monarch.");
const LINES = PRINTED.split('\n');

export const THORN_OF_THE_BLACK_ROSE_SCRIPT: CardScript = {
  oracleId: THORN_OF_THE_BLACK_ROSE.oracleId,
  name: THORN_OF_THE_BLACK_ROSE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Thorn of the Black Rose - monarch",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [{ t: 'MonarchChanged', player: obj.controller }, narrated(n`${who(ctx.state, obj.controller)} ${vb(obj.controller, 'becomes', 'become')} the monarch.`, obj.controller)];
      },
    },
  ],
};
