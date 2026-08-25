/**
 * Mirrors the DOM's own NotificationPermission ("default" / "granted" /
 * "denied") plus two states specific to whether a push subscription is
 * actually registered with SAOVIA (permission can be "granted" while no
 * subscription row exists yet, e.g. right after granting).
 */
export type PushSubscriptionState = "unsupported" | "unsubscribed" | "subscribed" | "denied";
