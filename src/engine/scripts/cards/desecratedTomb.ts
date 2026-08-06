// `Desecrated Tomb` — "Whenever one or more creature cards leave your
// graveyard, create a 1/1 black Bat creature token with flying." The FIRST
// graveyard-exit watcher (D171): CardsMoved FROM the controller's graveyard,
// the mover's card-type read off the ORACLE face (a graveyard card has no
// battlefield derivation), and the per-event batching is EXACTLY the card's
// own "one or more" wording. M6.4o, D171.

import { DESECRATED_TOMB } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import { faceOf } from '../../oracle';
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

const TEXT = printed(
  DESECRATED_TOMB,
  'Whenever one or more creature cards leave your graveyard, create a 1/1 black Bat creature token with flying.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const BAT = tokenRef('Bat|1/1|B|Creature|flying');

export const DESECRATED_TOMB_SCRIPT: CardScript = {
  oracleId: DESECRATED_TOMB.oracleId,
  name: DESECRATED_TOMB.name,
  triggers: [
    {
      abilityId: 'gy-exit',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'graveyard') return false;
          if (m.from.player !== ctx.query.controllerOf(self)) return false;
          const inst = ctx.state.cards[m.card];
          const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
          if (!oc) return false;
          return faceOf(oc, inst?.faceIndex ?? 0).typeLine.types.includes('Creature');
        }),
      label: () => 'Desecrated Tomb — create a 1/1 Bat with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: BAT.oracleId,
          printingId: BAT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
