// `Centaur Safeguard` - a dies trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CENTAUR_SAFEGUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CENTAUR_SAFEGUARD, "({G/W} can be paid with either {G} or {W}.)\nWhen this creature dies, you may gain 3 life.");
const LINES = PRINTED.split('\n');

export const CENTAUR_SAFEGUARD_SCRIPT: CardScript = {
  oracleId: CENTAUR_SAFEGUARD.oracleId,
  name: CENTAUR_SAFEGUARD.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Centaur Safeguard - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
};
