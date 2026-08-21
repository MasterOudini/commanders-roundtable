// `Sentinel of the Nameless City` — "Vigilance / Whenever this creature
// enters or attacks, create a Map token." Grave Titan's enters-or-
// attacks pair on the committed tbig-7 Map pin. D245.

import { SENTINEL_OF_THE_NAMELESS_CITY } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { PlayerId } from '../../types/ids';

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
  SENTINEL_OF_THE_NAMELESS_CITY,
  'Vigilance\nWhenever this creature enters or attacks, create a Map token. ' +
    '(It\'s an artifact with "{1}, {T}, Sacrifice this token: Target creature you control explores. Activate only as a sorcery.")',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const MAP = tokenRef('Map|/||Artifact|');

function mapToken(ctx: ScriptCtx, controller: PlayerId): EventBody {
  return {
    t: 'TokenCreated',
    card: ctx.ids.nextInstance(),
    oracleId: MAP.oracleId,
    printingId: MAP.printingId,
    controller,
    owner: controller,
    turnNumber: ctx.state.turn.turnNumber,
  };
}

export const SENTINEL_OF_THE_NAMELESS_CITY_SCRIPT: CardScript = {
  oracleId: SENTINEL_OF_THE_NAMELESS_CITY.oracleId,
  name: SENTINEL_OF_THE_NAMELESS_CITY.name,
  triggers: [
    {
      abilityId: 'etb-map',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Sentinel of the Nameless City — create a Map token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [mapToken(ctx, obj.controller)],
    },
    {
      abilityId: 'attacks-map',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Sentinel of the Nameless City — create a Map token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [mapToken(ctx, obj.controller)],
    },
  ],
};
