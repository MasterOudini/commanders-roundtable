// `Bontu's Monument` - a castCreatureSpell trigger drain
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BONTU_S_MONUMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BONTU_S_MONUMENT, "Black creature spells you cast cost {1} less to cast.\nWhenever you cast a creature spell, each opponent loses 1 life and you gain 1 life.");
const LINES = PRINTED.split('\n');

export const BONTUS_MONUMENT_SCRIPT: CardScript = {
  oracleId: BONTU_S_MONUMENT.oracleId,
  name: BONTU_S_MONUMENT.name,
  triggers: [
    {
      abilityId: 'castCreatureSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Bontu's Monument - drain",
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
