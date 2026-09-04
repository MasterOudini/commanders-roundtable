// `Blood Fountain` - "When this artifact enters, create a Blood token" (the
// pinned Blood printing, belligerentGuest's) and "{3}{B}, {T}, Sacrifice this
// artifact: Return up to two target creature cards from your graveyard to your
// hand" (D299's count over D138's creature card).

import { BLOOD_FOUNTAIN } from '../../../data/fixtures/engineCards';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(
  BLOOD_FOUNTAIN,
  'When this artifact enters, create a Blood token. (It\'s an artifact with "{1}, {T}, Discard a card, Sacrifice this token: Draw a card.")\n{3}{B}, {T}, Sacrifice this artifact: Return up to two target creature cards from your graveyard to your hand.',
);
const LINES = PRINTED.split('\n');
const BLOOD = tokenRef('Blood|/||Artifact|');

export const BLOOD_FOUNTAIN_SCRIPT: CardScript = {
  oracleId: BLOOD_FOUNTAIN.oracleId,
  name: BLOOD_FOUNTAIN.name,
  triggers: [
    {
      abilityId: 'etb',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => 'Blood Fountain - create a Blood token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: BLOOD.oracleId,
          printingId: BLOOD.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
  activated: [
    {
      ref: `${BLOOD_FOUNTAIN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick ("up to two" may be declared with fewer).
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'graveyard') continue;
          out.push({ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'graveyard', player: card.owner }, to: { kind: 'hand', player: card.owner } }] });
        }
        return out;
      },
    },
  ],
};
