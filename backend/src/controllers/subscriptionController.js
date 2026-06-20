import crypto from "crypto";
import { Subscription } from "../models/Subscription.js";
import { Payment } from "../models/Payment.js";
import { User } from "../models/User.js";
import { AppError } from "../middlewares/errorHandler.js";
import { notify } from "../services/notificationService.js";

const PRICE_CENTS = 2999; // mock monthly price

function nextMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

export async function getMySubscription(req, res, next) {
  try {
    const item = await Subscription.findOne({
      userId: req.auth.userId,
      status: "active",
      endDate: { $gt: new Date() },
    });
    res.json({ subscription: item });
  } catch (err) {
    next(err);
  }
}

export async function subscribeCoach(req, res, next) {
  try {
    const { coachId } = req.body ?? {};
    if (!coachId) throw new AppError("coachId is required", { code: "VALIDATION_ERROR" });

    const coach = await User.findOne({ _id: coachId, role: "coach" });
    if (!coach) {
      throw new AppError("Coach not found or not approved", { statusCode: 404, code: "NOT_FOUND" });
    }

    const existing = await Subscription.findOne({
      userId: req.auth.userId,
      status: "active",
      endDate: { $gt: new Date() },
    });
    if (existing) {
      if (String(existing.coachId) !== String(coachId)) {
        throw new AppError("You already have an active coach subscription", {
          statusCode: 409,
          code: "ACTIVE_SUBSCRIPTION_EXISTS",
        });
      }
      const payment = await Payment.findById(existing.paymentId);
      res.json({ subscription: existing, payment });
      return;
    }

    const startDate = new Date();
    const sub = await Subscription.create({
      userId: req.auth.userId,
      coachId,
      startDate,
      endDate: nextMonth(startDate),
      status: "active",
    });
    const payment = await Payment.create({
      userId: req.auth.userId,
      subscriptionId: sub._id,
      amountCents: PRICE_CENTS,
      currency: "USD",
      status: "succeeded",
      provider: "mock",
      providerRef: `mock_${crypto.randomBytes(8).toString("hex")}`,
    });
    sub.paymentId = payment._id;
    await sub.save();
    await User.findByIdAndUpdate(req.auth.userId, { $set: { activeSubscriptionId: sub._id } });

    // Item 7: the user keeps their AI plan active until the coach authors a plan.
    await notify(req.auth.userId, "subscription_activated", {
      title: "Subscription activated",
      body: "Your coach can now build your plans. You'll keep your AI plan until they do.",
      metadata: { coachId, subscriptionId: sub.id },
    });

    res.status(201).json({ subscription: sub, payment });
  } catch (err) {
    next(err);
  }
}

export async function cancelMySubscription(req, res, next) {
  try {
    const item = await Subscription.findOne({
      userId: req.auth.userId,
      status: "active",
      endDate: { $gt: new Date() },
    });
    if (!item) {
      throw new AppError("No active subscription found", { statusCode: 404, code: "NOT_FOUND" });
    }
    // Cancel-at-period-end: remains active until endDate; the lifecycle job then
    // expires it and reverts the user to AI plans (docs/06 §6.3).
    item.cancelledAt = new Date();
    await item.save();
    res.json({
      subscription: item,
      message: "Subscription will remain active until the end of the current period.",
    });
  } catch (err) {
    next(err);
  }
}
