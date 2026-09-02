// `Hermes, Overseer of Elpis` — "Whenever you cast a noncreature spell,
// create a 1/1 blue Bird creature token with flying and vigilance.\nWhenever
// you attack with one or more Birds, scry 2." Cruel Witness's noncreature
// cast watcher (the cast face read through faceOf) making the pool's blue
// flying-vigilance Bird (tfic 4, pinned this batch), and an attack watcher
// that matches when ANY declared attacker is a Bird I control — a batch
// match on AttackersDeclared, then D195's scry with the ask LAST. D276.

import { HERMES_OVERSEER_OF_ELPIS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  HERMES_OVERSEER_OF_ELPIS,
  'Whenever you cast a noncreature spell, create a 1/1 blue Bird creature token with flying and vigilance.\nWhenever you attack with one or more Birds, scry 2.',
);
const CAST = PRINTED.split('\n')[0] as string;
const ATTACK = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const BIRD = tokenRef('Bird|1/1|U|Creature|flying|vigilance');

export const HERMES_OVERSEER_OF_ELPIS_SCRIPT: CardScript = {
  oracleId: HERMES_OVERSEER_OF_ELPIS.oracleId,
  name: HERMES_OVERSEER_OF_ELPIS.name,
  triggers: [
    {
      abilityId: 'noncreature-cast',
      text: CAST,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        return !faceOf(oc, ev.obj.faceIndex).typeLine.types.includes('Creature');
      },
      label: () => 'Hermes, Overseer of Elpis — create a 1/1 Bird',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: BIRD.oracleId,
          printingId: BIRD.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
    {
      abilityId: 'attack-with-birds',
      text: ATTACK,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' &&
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self) &&
        ev.attackers.some((a) => {
          const inst = ctx.state.cards[a.card];
          if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(a.card).typeLine.subtypes.includes('Bird');
        }),
      label: () => 'Hermes, Overseer of Elpis — scry 2',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count: n,
              toGraveyard: false,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
