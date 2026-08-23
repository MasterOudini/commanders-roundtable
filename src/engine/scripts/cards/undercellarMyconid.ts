// `Undercellar Myconid` — the enters-OR-dies pair (Grave Titan's shape,
// D178): ONE printed line, TWO defs, each paying a Saproling. The mana line
// beside it is the engine's, so this def claims `split[0]` alone.
//
// ⚠️ Two defs rather than one, because the two arms watch the SAME event
// (`CardsMoved`) with opposite destinations and only the dies arm may look
// back (CR 603.10a). The resolve is inlined twice rather than shared through
// a helper — D178 does the same, and a helper here would need a hand-rolled
// context type for nothing. D263.

import { UNDERCELLAR_MYCONID } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import type { TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(
  UNDERCELLAR_MYCONID,
  'Whenever this creature enters or dies, create a 1/1 green Saproling creature token.\n{T}: Add one mana of any color.',
);
const TEXT = PRINTED.split('\n')[0] as string;

const SAPROLING = tokenRef('Saproling|1/1|G|Creature|');

export const UNDERCELLAR_MYCONID_SCRIPT: CardScript = {
  oracleId: UNDERCELLAR_MYCONID.oracleId,
  name: UNDERCELLAR_MYCONID.name,
  triggers: [
    {
      abilityId: 'enters',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Undercellar Myconid — create a 1/1 Saproling',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SAPROLING.oracleId,
          printingId: SAPROLING.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Undercellar Myconid — create a 1/1 Saproling',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SAPROLING.oracleId,
          printingId: SAPROLING.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
