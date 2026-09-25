// `Doomskar Oracle` - a secondSpell trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DOOMSKAR_ORACLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DOOMSKAR_ORACLE, "Whenever you cast your second spell each turn, you gain 2 life.\nForetell {W} (During your turn, you may pay {2} and exile this card from your hand face down. Cast it on a later turn for its foretell cost.)");
const LINES = PRINTED.split('\n');

export const DOOMSKAR_ORACLE_SCRIPT: CardScript = {
  oracleId: DOOMSKAR_ORACLE.oracleId,
  name: DOOMSKAR_ORACLE.name,
  triggers: [
    {
      abilityId: 'secondSpell-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Doomskar Oracle - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
};
