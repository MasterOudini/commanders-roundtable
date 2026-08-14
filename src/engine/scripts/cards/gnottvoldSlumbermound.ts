// `Gnottvold Slumbermound` — Land, enters tapped (D134's built-in owes line
// 1) with "{3}{R}{G}{G}, {T}, Sacrifice this land: Destroy target land.
// Create a 4/4 green Troll Warrior creature token with trample." The first
// TWO-SENTENCE activated resolve: the destroy respects indestructible
// (CR 701.7b) and the Troll arrives EITHER WAY — an indestructible target
// stops the destruction, not the second sentence. M6.4u, D177.

import { GNOTTVOLD_SLUMBERMOUND } from '../../../data/fixtures/engineCards';
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
  GNOTTVOLD_SLUMBERMOUND,
  'This land enters tapped.\n{T}: Add {R}.\n{3}{R}{G}{G}, {T}, Sacrifice this land: Destroy target land. Create a 4/4 green Troll Warrior creature token with trample.',
);
const TEXT = PRINTED.split('\n')[2] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const TROLL = tokenRef('Troll Warrior|4/4|G|Creature|trample');

export const GNOTTVOLD_SLUMBERMOUND_SCRIPT: CardScript = {
  oracleId: GNOTTVOLD_SLUMBERMOUND.oracleId,
  name: GNOTTVOLD_SLUMBERMOUND.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0; the enters-tapped line has
      // no colon and is D134's built-in.
      ref: `${GNOTTVOLD_SLUMBERMOUND.oracleId}#a1`,
      text: TEXT,
      // The Slumbermound is already in the graveyard when this runs (D159's
      // charge order), so nothing here may ask about `self`'s position.
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const events: EventBody[] = [];
        const target = obj.targets[0];
        if (target && target.kind === 'card') {
          const card = ctx.state.cards[target.id];
          if (
            card &&
            card.zone.kind === 'battlefield' &&
            // CR 701.7b — an indestructible permanent is not destroyed; the
            // Troll below still arrives.
            !ctx.derive(target.id).keywords.has('indestructible')
          ) {
            events.push({
              t: 'CardsMoved',
              moves: [
                {
                  card: target.id,
                  from: { kind: 'battlefield', player: card.controller },
                  to: { kind: 'graveyard', player: card.owner },
                },
              ],
            });
          }
        }
        events.push({
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: TROLL.oracleId,
          printingId: TROLL.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        });
        return events;
      },
    },
  ],
};
