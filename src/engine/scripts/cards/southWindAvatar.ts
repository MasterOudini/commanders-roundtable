// `South Wind Avatar` - a anotherCreatureDies trigger vocab, a youGainLife trigger loseLifeOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOUTH_WIND_AVATAR } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(SOUTH_WIND_AVATAR, "Deathtouch\nWhenever another creature you control dies, you gain life equal to its toughness.\nWhenever you gain life, each opponent loses 1 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You gain life equal to target creature's toughness.", SOUTH_WIND_AVATAR.name);
const VOCAB_T_L1 = vocabularyTargets("You gain life equal to target creature's toughness.");

export const SOUTH_WIND_AVATAR_SCRIPT: CardScript = {
  oracleId: SOUTH_WIND_AVATAR.oracleId,
  name: SOUTH_WIND_AVATAR.name,
  triggers: [
    {
      abilityId: 'anotherCreatureDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      memo: (ctx, _self, _ev, item) => (item !== undefined ? (ctx.derive(item).toughness ?? 0) : 0),
      optional: false,
      looksBack: true,
      perItem: (ctx, self, ev) => (ev.t === 'CardsMoved' ? ev.moves.filter((m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature')).map((m) => m.card) : []),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "South Wind Avatar - You gain life equal to target creature's toughness.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L1, VOCAB_T_L1, true);
      },
    },
    {
      abilityId: 'youGainLife-2',
      text: LINES[2] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "South Wind Avatar - loseLifeOpponents",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -1, to: p.life - 1 });
        }
        return out;
      },
    },
  ],
};
