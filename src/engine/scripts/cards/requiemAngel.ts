// `Requiem Angel` — "Whenever another non-Spirit creature you control
// dies, create a 1/1 white Spirit creature token with flying." The
// NEGATED-subtype dies watcher; her own token's death pays nothing (a
// Spirit), and her own death pays nothing (not another). The Flying
// line is the engine's. D239.

import { REQUIEM_ANGEL } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

const PRINTED = printed(
  REQUIEM_ANGEL,
  'Flying\nWhenever another non-Spirit creature you control dies, create a 1/1 white Spirit creature token with flying.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SPIRIT = tokenRef('Spirit|1/1|W|Creature|flying');

export const REQUIEM_ANGEL_SCRIPT: CardScript = {
  oracleId: REQUIEM_ANGEL.oracleId,
  name: REQUIEM_ANGEL.name,
  triggers: [
    {
      abilityId: 'dies-spirit',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          if (m.card === self) return false;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
          const d = ctx.derive(m.card);
          if (!d.typeLine.types.includes('Creature')) return false;
          return !d.typeLine.subtypes.includes('Spirit');
        }),
      label: () => 'Requiem Angel — create a 1/1 white Spirit token with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SPIRIT.oracleId,
          printingId: SPIRIT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
