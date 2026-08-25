// `Wild Instincts` — pump THEN fight, Swift Kick's shape (D255) with +2/+2
// instead of +1/+0 and "an opponent controls" instead of "you don't control".
//
// ⚠️⚠️ TWO specs, and the resolve identifies them BY CONTROLLER, never by
// `obj.targets` index. D255 measured that a swapped multi-spec answer is
// ACCEPTED by the aim layer and then FIZZLES at CR 608.2b's positional
// re-check, so a positional read is the bug that finding names. Swift Kick
// already reads by controller; this follows it exactly.
//
// ⚠️ The +2/+2 is applied in this same batch, so the biter's power must have
// it ADDED by hand — the derive cannot see an effect from the batch it is in.
// D269.

import { WILD_INSTINCTS } from '../../../data/fixtures/engineCards';
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
  WILD_INSTINCTS,
  'Target creature you control gets +2/+2 until end of turn. It fights target creature an opponent controls. (Each deals damage equal to its power to the other.)',
);

export const WILD_INSTINCTS_SCRIPT: CardScript = {
  oracleId: WILD_INSTINCTS.oracleId,
  name: WILD_INSTINCTS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
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
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: mine, power: 2, toughness: 2, keywords: [] },
      ];
      if (theirs === null) return events;

      const biter = ctx.derive(mine);
      const bitten = ctx.derive(theirs);
      const biterPower = (biter.power ?? 0) + 2;
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
          applyAs:
            biter.keywords.has('infect') || biter.keywords.has('wither') ? 'wither' : 'normal',
        } as const);
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
          applyAs:
            bitten.keywords.has('infect') || bitten.keywords.has('wither') ? 'wither' : 'normal',
        } as const);
      }
      if (damages.length > 0) events.push({ t: 'DamageDealt', damages });
      return events;
    },
  },
};
