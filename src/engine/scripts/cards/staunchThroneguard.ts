// `Staunch Throneguard` - a etb trigger monarch
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STAUNCH_THRONEGUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STAUNCH_THRONEGUARD, "Vigilance\nWhen this creature enters, you become the monarch.");
const LINES = PRINTED.split('\n');

export const STAUNCH_THRONEGUARD_SCRIPT: CardScript = {
  oracleId: STAUNCH_THRONEGUARD.oracleId,
  name: STAUNCH_THRONEGUARD.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Staunch Throneguard - monarch",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [{ t: 'MonarchChanged', player: obj.controller }, narrated(n`${who(ctx.state, obj.controller)} ${vb(obj.controller, 'becomes', 'become')} the monarch.`, obj.controller)];
      },
    },
  ],
};
