// Combat choreography — the lunge and the intercept.
//
// The geometry is PURE and exported so it can be unit-tested and so the battery can
// assert against the same numbers the animation used, rather than against a
// re-derivation that could drift.
//
// ⚠️ AN ATTACK MUST POINT AT ITS DEFENDER. In a two-player game "attacking" can be
// a generic forward lunge, because there is only one place to go. At four players
// a lunge that does not visibly aim at a specific pod is actively misleading —
// you cannot tell who is being attacked, which is the single most important fact
// in the combat step. Hence the assertion the battery makes: every attacker's
// displacement has a POSITIVE DOT PRODUCT with the unit vector toward its assigned
// pod. That is a numeric statement of "it moved toward the right player".

import { animate } from 'motion';
import type { InstanceId, PlayerId } from '../../view/types';
import { zoneId } from '../../view/types';
import { DUR, EASE, SPRING, STAGGER, d, ds } from './tokens';
import { cardSlot, elementFor, readAll, resolve, zoneSlot, type FrozenRect } from './rectRegistry';
import { burst, HUE } from './fx/fxBus';

export interface Pt {
  x: number;
  y: number;
}

function centre(r: FrozenRect): Pt {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Lunge distance. Shorter at 3–4 players, where the pods are closer together. */
export function lungeDistance(seatCount: number): number {
  return seatCount <= 2 ? 46 : 38;
}

/** The displacement an attacker should take toward its defender. */
export function lungeVector(from: Pt, toward: Pt, distance: number): Pt {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const len = Math.hypot(dx, dy);
  // A creature already on top of its target still has to move, or the beat reads as
  // nothing happening. Default to "up the table", which is where opponents are.
  if (len < 1) return { x: 0, y: -distance };
  return { x: (dx / len) * distance, y: (dy / len) * distance };
}

/**
 * Where a blocker should come to rest.
 *
 * 38% of the way toward the attacker, then offset PERPENDICULAR by 55% of a card
 * width. Both parts matter: without the fractional approach the blocker covers the
 * attacker completely, and without the perpendicular offset two blockers on one
 * attacker land in the same place. Keeping both cards fully visible is the whole
 * point — you have to be able to read the power and toughness of both.
 */
export function interceptPoint(
  attacker: Pt,
  blocker: Pt,
  cardWidth: number,
  side: number,
): Pt {
  const dx = attacker.x - blocker.x;
  const dy = attacker.y - blocker.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  return {
    x: blocker.x + dx * 0.38 + px * side * cardWidth * 0.55,
    y: blocker.y + dy * 0.38 + py * side * cardWidth * 0.55,
  };
}

/** Multi-block fan: blockers arc around the attacker at ±18° steps. */
export function blockerSide(index: number, total: number): number {
  if (total <= 1) return 1;
  // Alternate sides outward from the centre: 0 → +1, 1 → −1, 2 → +2, …
  const step = Math.floor(index / 2) + 1;
  return index % 2 === 0 ? step : -step;
}

export interface AttackPlan {
  instanceId: InstanceId;
  defender: PlayerId;
  from: Pt;
  toward: Pt;
  displacement: Pt;
}

/** Plan every lunge, reading all rects in ONE batched pass. */
export function planAttacks(
  attackers: { instanceId: InstanceId; defender: PlayerId }[],
  seatCount: number,
): AttackPlan[] {
  const keys = [
    ...attackers.map((a) => cardSlot(a.instanceId)),
    ...new Set(attackers.map((a) => zoneSlot(zoneId('bf', a.defender)))),
  ];
  const rects = readAll(keys);
  const distance = lungeDistance(seatCount);

  return attackers.map((a) => {
    const from = centre(rects.get(cardSlot(a.instanceId)) ?? resolve(a.instanceId, 'stack'));
    const toward = centre(
      rects.get(zoneSlot(zoneId('bf', a.defender))) ?? resolve(null, zoneId('bf', a.defender)),
    );
    return {
      instanceId: a.instanceId,
      defender: a.defender,
      from,
      toward,
      displacement: lungeVector(from, toward, distance),
    };
  });
}

export interface BlockPlan {
  blocker: InstanceId;
  attacker: InstanceId;
  from: Pt;
  target: Pt;
  displacement: Pt;
}

export function planBlocks(
  blocks: { blocker: InstanceId; attacker: InstanceId }[],
  cardWidth: number,
): BlockPlan[] {
  const keys = [
    ...blocks.map((b) => cardSlot(b.blocker)),
    ...blocks.map((b) => cardSlot(b.attacker)),
  ];
  const rects = readAll(keys);

  // Group by attacker, so a multi-block fans instead of stacking.
  const byAttacker = new Map<InstanceId, { blocker: InstanceId; attacker: InstanceId }[]>();
  for (const b of blocks) {
    const list = byAttacker.get(b.attacker) ?? [];
    list.push(b);
    byAttacker.set(b.attacker, list);
  }

  const plans: BlockPlan[] = [];
  for (const [attackerId, group] of byAttacker) {
    const attackerRect = rects.get(cardSlot(attackerId));
    const attacker = centre(attackerRect ?? resolve(attackerId, 'stack'));
    group.forEach((b, i) => {
      const blockerRect = rects.get(cardSlot(b.blocker));
      const from = centre(blockerRect ?? resolve(b.blocker, 'stack'));
      const target = interceptPoint(attacker, from, cardWidth, blockerSide(i, group.length));
      plans.push({
        blocker: b.blocker,
        attacker: attackerId,
        from,
        target,
        displacement: { x: target.x - from.x, y: target.y - from.y },
      });
    });
  }
  return plans;
}

/** Animate the lunges. Staggered, so five attackers read as a charge, not a jump. */
export async function runAttacks(plans: AttackPlan[]): Promise<void> {
  const step = d(STAGGER.attackers);
  await Promise.all(
    plans.map(async (plan, i) => {
      if (step > 0 && i > 0) await new Promise((r) => setTimeout(r, step * i));
      const el = elementFor(cardSlot(plan.instanceId));
      if (!el) return;
      const u = plan.displacement;
      const len = Math.hypot(u.x, u.y) || 1;
      burst({
        x: plan.from.x, y: plan.from.y, count: 6,
        speedMin: 20, speedMax: 60, lifeMin: 200, lifeMax: 340,
        sizeMin: 1, sizeMax: 3, hue: HUE.danger,
        direction: Math.atan2(u.y, u.x), spread: 0.6,
      });
      await animate(
        el,
        {
          x: [0, u.x],
          y: [0, u.y],
          // It cants INTO the charge — a purely translational lunge reads as a
          // slide rather than as a creature leaning forward.
          rotate: [0, (u.x / len) * 4],
          scale: [1, 1.05],
        },
        { duration: ds(DUR.attackLunge), ease: EASE.overshoot },
      );
    }),
  );
}

export async function runBlocks(plans: BlockPlan[]): Promise<void> {
  const step = d(STAGGER.blockers);
  await Promise.all(
    plans.map(async (plan, i) => {
      if (step > 0 && i > 0) await new Promise((r) => setTimeout(r, step * i));
      const el = elementFor(cardSlot(plan.blocker));
      if (!el) return;
      await animate(
        el,
        { x: [0, plan.displacement.x], y: [0, plan.displacement.y], scale: [1, 1.02] },
        { duration: ds(DUR.blockSlide), ease: EASE.out },
      );
      // The attacker recoils 8 px back toward its origin — "checked".
      const attackerEl = elementFor(cardSlot(plan.attacker));
      if (attackerEl) {
        void animate(attackerEl, { scale: [1.05, 1.0] }, SPRING.nudge);
      }
    }),
  );
}

/** Return every attacker and blocker to its resting pose (end of combat). */
export async function clearCombatPoses(instanceIds: InstanceId[]): Promise<void> {
  await Promise.all(
    instanceIds.map((id) => {
      const el = elementFor(cardSlot(id));
      if (!el) return Promise.resolve();
      return animate(el, { x: 0, y: 0, rotate: 0, scale: 1 }, { duration: ds(DUR.resolve), ease: EASE.out });
    }),
  );
}
