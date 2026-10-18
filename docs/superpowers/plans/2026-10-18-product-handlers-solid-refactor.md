# Merjane Product Handlers + SOLID Refactor

> **For agentic workers:** Use TDD. Run `pnpm test` (or scoped vitest) after every red/green step. Do not change WARN-protected notification files.

**Goal:** Lock NORMAL / SEASONAL / EXPIRABLE behavior with integration (+ unit) tests, then extract `Product`, repositories, and per-type handlers; slim the controller to HTTP only.

**Models:** Developer Claude Opus 4.8 · Reviewer Grok 4.7

## Target layout

| Unit | Responsibility |
|------|----------------|
| `src/domain/product.ts` | `Product` value object / helpers (type, availability queries) |
| `src/repositories/product.repository.ts` | Persist product stock / load by id |
| `src/repositories/order.repository.ts` | Load order with products |
| `src/services/product-handlers/*.ts` | One handler per type (NORMAL, SEASONAL, EXPIRABLE) |
| `src/services/impl/product.service.ts` | Orchestrate process line-item via handler registry |
| `src/controllers/my-controller.ts` | HTTP: validate, 404, transaction boundary, call service |

## Cahier scenarios (must have tests)

### NORMAL
1. In stock → decrement, no notify
2. OOS + leadTime ≥ 0 → `sendDelayNotification(leadTime, name)`, available unchanged

### SEASONAL
3. In season + stock → decrement
4. In season + OOS + restock ≤ seasonEnd → delay
5. In season + OOS + restock > seasonEnd → out-of-stock notify, unavailable
6. Before season start → out-of-stock notify, available unchanged
7. After season end → out-of-stock notify (do not wipe unrelated logic beyond cahier)

### EXPIRABLE
8. Not expired + stock → decrement
9. Expired → `sendExpirationNotification`, available = 0
10. Not expired + OOS → delay (not expiration)

### Cross-cutting (already partially done)
11. Missing order → 404
12. Invalid orderId → 400
13. Mid-order failure → rollback

## Task order

1. Integration tests characterizing each product type (cahier) — expect some RED
2. Unit tests for handlers / Product — RED then GREEN
3. Repository extraction — keep tests green
4. Wire DI + slim controller — green suite
5. Update `reports/findings.json` for newly fixed issues

## Constraints

- Notification port/service: do not modify
- Commits only if human asks
- No product UI redesign
