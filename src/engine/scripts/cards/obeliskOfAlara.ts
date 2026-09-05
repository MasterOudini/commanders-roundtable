// `Obelisk of Alara` - an activation gainLife, an activation loot, an activation pumpTarget, an activation damageTarget, an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OBELISK_OF_ALARA } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(OBELISK_OF_ALARA, "{1}{W}, {T}: You gain 5 life.\n{1}{U}, {T}: Draw a card, then discard a card.\n{1}{B}, {T}: Target creature gets -2/-2 until end of turn.\n{1}{R}, {T}: This artifact deals 3 damage to target player or planeswalker.\n{1}{G}, {T}: Target creature gets +4/+4 until end of turn.");
const LINES = PRINTED.split('\n');

export const OBELISK_OF_ALARA_SCRIPT: CardScript = {
  oracleId: OBELISK_OF_ALARA.oracleId,
  name: OBELISK_OF_ALARA.name,
  activated: [
    {
      ref: `${OBELISK_OF_ALARA.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 5, to: me.life + 5 }];
      },
    },
    {
      ref: `${OBELISK_OF_ALARA.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Obelisk of Alara - discard a card" } },
        ];
      },
    },
    {
      ref: `${OBELISK_OF_ALARA.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: -2 }];
      },
    },
    {
      ref: `${OBELISK_OF_ALARA.oracleId}#a3`,
      text: LINES[3] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        const d = ctx.derive(self);
        const infect = d.keywords.has('infect');
        const wither = d.keywords.has('wither');
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
                amount: 3,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount ?? 0,
                applyAs: target.kind === 'player' && infect ? 'poison' : infect || wither ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
    {
      ref: `${OBELISK_OF_ALARA.oracleId}#a4`,
      text: LINES[4] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 4, toughness: 4 }];
      },
    },
  ],
};
