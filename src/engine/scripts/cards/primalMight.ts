// `Primal Might` — my creature gets +X/+X until cleanup (X off the stack),
// then fights up to one creature I don't control with its pumped power
// (Savage Punch's fight, the targets told apart by controller, D288).

import { PRIMAL_MIGHT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  PRIMAL_MIGHT,
  "Target creature you control gets +X/+X until end of turn. Then it fights up to one target creature you don't control. (Each deals damage equal to its power to the other.)",
);

export const PRIMAL_MIGHT_SCRIPT: CardScript = {
  oracleId: PRIMAL_MIGHT.oracleId,
  name: PRIMAL_MIGHT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      let mine: InstanceId | null = null;
      let theirs: InstanceId | null = null;
      for (const target of obj.targets) {
        if (!target || target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        if (card.controller === obj.controller) mine ??= target.id;
        else theirs ??= target.id;
      }
      if (mine === null) return [];
      const events: EventBody[] = [{ t: 'PtModifiedUntilEndOfTurn', card: mine, power: x, toughness: x, keywords: [] }];
      if (theirs === null) return events;
      const biter = ctx.derive(mine);
      const bitten = ctx.derive(theirs);
      const biterPower = (biter.power ?? 0) + x;
      const bittenPower = bitten.power ?? 0;
      const theirController = ctx.state.cards[theirs]?.controller;
      const damages = [];
      if (biterPower > 0) {
        damages.push({
          source: mine,
          target: { kind: 'card' as const, id: theirs },
          amount: biterPower,
          deathtouch: biter.keywords.has('deathtouch'),
          lifelinkTo: biter.keywords.has('lifelink') ? obj.controller : null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: biter.keywords.has('infect') || biter.keywords.has('wither') ? ('wither' as const) : ('normal' as const),
        });
      }
      if (bittenPower > 0) {
        damages.push({
          source: theirs,
          target: { kind: 'card' as const, id: mine },
          amount: bittenPower,
          deathtouch: bitten.keywords.has('deathtouch'),
          lifelinkTo: bitten.keywords.has('lifelink') && theirController ? theirController : null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: bitten.keywords.has('infect') || bitten.keywords.has('wither') ? ('wither' as const) : ('normal' as const),
        });
      }
      if (damages.length > 0) events.push({ t: 'DamageDealt', damages });
      return events;
    },
  },
};
