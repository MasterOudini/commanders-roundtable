// `Dubious Delicacy` - a Food with an entering shrink: "When this artifact enters,
// up to one target creature gets -3/-3 until end of turn" (D299's count), then
// the two sacrifice activations - "You gain 3 life" and "Target opponent loses
// 3 life". Flash is the engine's.

import { DUBIOUS_DELICACY } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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
  DUBIOUS_DELICACY,
  'Flash\nWhen this artifact enters, up to one target creature gets -3/-3 until end of turn.\n{2}, {T}, Sacrifice this artifact: You gain 3 life.\n{2}, {T}, Sacrifice this artifact: Target opponent loses 3 life.',
);
const LINES = PRINTED.split('\n');
const ENTERS = LINES[1] as string;

export const DUBIOUS_DELICACY_SCRIPT: CardScript = {
  oracleId: DUBIOUS_DELICACY.oracleId,
  name: DUBIOUS_DELICACY.name,
  triggers: [
    {
      abilityId: 'etb',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(ENTERS),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => 'Dubious Delicacy - up to one target creature gets -3/-3 until end of turn',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick ("up to one" may be declared with none).
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -3, toughness: -3 });
        }
        return out;
      },
    },
  ],
  activated: [
    {
      ref: `${DUBIOUS_DELICACY.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
    {
      ref: `${DUBIOUS_DELICACY.oracleId}#a1`,
      text: LINES[3] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const them = ctx.state.players[target.id];
        if (!them || them.hasLost) return [];
        return [{ t: 'LifeChanged', player: target.id, delta: -3, to: them.life - 3 }];
      },
    },
  ],
};
