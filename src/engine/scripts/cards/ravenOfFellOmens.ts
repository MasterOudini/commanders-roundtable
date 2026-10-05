// `Raven of Fell Omens` - a youCommitCrime trigger drain
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAVEN_OF_FELL_OMENS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAVEN_OF_FELL_OMENS, "Flying\nWhenever you commit a crime, each opponent loses 1 life and you gain 1 life. This ability triggers only once each turn. (Targeting opponents, anything they control, and/or cards in their graveyards is a crime.)");
const LINES = PRINTED.split('\n');

export const RAVEN_OF_FELL_OMENS_SCRIPT: CardScript = {
  oracleId: RAVEN_OF_FELL_OMENS.oracleId,
  name: RAVEN_OF_FELL_OMENS.name,
  triggers: [
    {
      abilityId: 'youCommitCrime-1',
      text: LINES[1] as string,
      event: 'CrimeCommitted',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'CrimeCommitted' && ev.player === ctx.query.controllerOf(self),
      label: () => "Raven of Fell Omens - drain",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -1, to: p.life - 1 });
        }
        const me = ctx.state.players[obj.controller];
        if (me) out.push({ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 });
        return out;
      },
    },
  ],
};
