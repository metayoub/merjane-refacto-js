### Consignes JS:

- Si probleme de version pnpm, utiliser `corepack enable pnpm` qui devrait automatiquement utiliser la bonne version
- Ne pas modifier les classes qui ont un commentaire: `// WARN: Should not be changed during the exercise
`
- Pour lancer les tests: `pnpm test`
  - integration only in watch mode `pnpm test:integration`
  - unit only in watch mode `pnpm test:unit`

# Merjane Refacto (JS)

Order-processing API built with Fastify, Drizzle ORM, and SQLite.

## What we did (refactor exercise)

### 1. Audits (dependencies)

| Command | What it checks | Where to see results |
| -------- | -------------- | -------------------- |
| `pnpm audit --prod` | Known CVEs on **production** dependencies | Terminal output (also CI job “Audit”) |
| `pnpm audit --prod --audit-level=critical` | Same, **fails** if any **critical** remains | Terminal / CI (blocking step) |
| Full narrative | Issues, severities, remediation | [`reports/security.html`](reports/security.html), [`reports/findings.json`](reports/findings.json) |

**Actions taken:** upgraded `fastify` → `4.29.1`, `convict` → `6.2.5`, `drizzle-orm` → `0.45.4` (+ matching `drizzle-kit`); removed unused `lodash`; forced `proxy-addr >= 2.0.8` via `pnpm.overrides`. Remaining highs are mostly Fastify v4 / build-chain transitive deps (logged in CI, not all block the build).

CI workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (`install` → `lint` → `test` → critical audit + full prod audit log).

### 2. Critical / integrity bugs fixed

| Problem | Fix |
| ------- | --- |
| Missing order crashed with HTTP 500 | Return **404** `{ message: 'Order not found' }` |
| Invalid `orderId` (`-1`, `1.5`, …) | Zod: positive integer → **400** |
| Mid-order failure left earlier stock decrements committed | One SQLite **BEGIN / COMMIT / ROLLBACK** per order |
| Concurrent oversell risk | Conditional `available - 1 WHERE available > 0`; if no row updated → treat as OOS / delay |

### 3. Refactor (SOLID / layers)

Business rules left the HTTP controller. New layout:

| Layer | Path | Role |
| ----- | ---- | ---- |
| Domain | `src/domain/product.ts` | `Product` object (stock / season / expiry helpers) |
| Repositories | `src/repositories/` | Order load + product stock updates |
| Handlers | `src/services/product-handlers/` | One handler per type: NORMAL / SEASONAL / EXPIRABLE |
| Service | `src/services/impl/product.service.ts` | Dispatches `process(product)` to the right handler |
| Controller | `src/controllers/my-controller.ts` | HTTP + transaction only |

**Unchanged (exercise-protected):** `src/services/notifications.port.ts`, `src/services/impl/notification.service.ts`.

Cahier alignment also fixed during the refactor: NORMAL OOS always delays (including `leadTime = 0`); SEASONAL before/after season notifies without wiping stock; EXPIRABLE OOS before expiry delays (not expiration).

### 4. Tests — what still works + what we added

Run everything: `pnpm test` (unit then integration).

**Still covered (previous behaviour):**

- Mixed catalogue order returns **200** (`ProcessOrderShouldReturn`)
- Delay notification persistence (`product.service.spec.ts`)
- NORMAL in stock → decrement; NORMAL OOS with leadTime → delay
- SEASONAL in season + stock → decrement; before season → out-of-stock notify
- EXPIRABLE in stock / expired paths

**Added (regression + cahier matrix):**

| Area | Cases |
| ---- | ----- |
| HTTP | 404 unknown order; 400 negative / non-integer `orderId`; rollback on mid-order failure |
| NORMAL | OOS with `leadTime = 0` still delays; lost decrement race → delay |
| SEASONAL | In-season OOS short/long lead; after season keeps stock; race fallback |
| EXPIRABLE | OOS before expiry → delay; race fallback |
| Unit | `Product` helpers; each handler; `ProductService.process` |

HTML reports (findings / security / coverage / delivery): [`reports/`](reports/).

## Available routes

| Method | Path                            | Description                                                                                       |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `POST` | `/orders/:orderId/processOrder` | Process an order: for each product, decrement stock or trigger delay / seasonal / expiry handling |

### `POST /orders/:orderId/processOrder`

- **Params:** `orderId` (positive integer)
- **Response (200):** `{ "orderId": <number> }`
- **Response (404):** order not found
- **Response (400):** invalid `orderId`
- **Behavior by product `type`:**
  - `NORMAL` — if stock &gt; 0, decrement; else delay notification (`leadTime`, including 0)
  - `SEASONAL` — sell only in season with stock; OOS delay unless restock after season end → out-of-stock; outside season → out-of-stock (stock kept)
  - `EXPIRABLE` — sell if not expired and in stock; expired → expiration notification + unavailable; OOS before expiry → delay

Example:

```bash
curl -X POST http://localhost:8888/orders/1/processOrder
```

## Main functions & modules

### App bootstrap

| Symbol         | File             | Role                                               |
| -------------- | ---------------- | -------------------------------------------------- |
| `main`         | `src/main.ts`    | Loads config, builds Fastify, listens on `0.0.0.0` |
| `buildFastify` | `src/fastify.ts` | Registers DI, DB, shutdown, and controller plugins |

### Controller

| Symbol         | File                               | Role                                              |
| -------------- | ---------------------------------- | ------------------------------------------------- |
| `myController` | `src/controllers/my-controller.ts` | HTTP: validate, 404, transaction, call `ps.process` |

### Domain & repositories

| Symbol             | File                                      | Role                          |
| ------------------ | ----------------------------------------- | ----------------------------- |
| `Product`          | `src/domain/product.ts`                   | Domain product object         |
| `ProductRepository`| `src/repositories/product.repository.ts`  | Stock / leadTime updates      |
| `OrderRepository`  | `src/repositories/order.repository.ts`    | Load order with product lines |

### Product service & handlers

| Symbol                         | File / folder                         | Role                                      |
| ------------------------------ | ------------------------------------- | ----------------------------------------- |
| `ProductService.process`       | `src/services/impl/product.service.ts`| Dispatch to type handler                  |
| `NormalProductHandler`         | `src/services/product-handlers/`      | NORMAL rules                              |
| `SeasonalProductHandler`       | `src/services/product-handlers/`      | SEASONAL rules                            |
| `ExpirableProductHandler`      | `src/services/product-handlers/`      | EXPIRABLE rules                           |

### Notification service (`NotificationService` / `INotificationService`)

| Method                                                | Role                             |
| ----------------------------------------------------- | -------------------------------- |
| `sendDelayNotification(leadTime, productName)`        | Delay notification (stub)        |
| `sendOutOfStockNotification(productName)`             | Out-of-stock notification (stub) |
| `sendExpirationNotification(productName, expiryDate)` | Expiration notification (stub)   |

Files: `src/services/impl/notification.service.ts`, `src/services/notifications.port.ts`  
_(Marked as exercise-protected — do not change during the refactor.)_

### DI

| Symbol               | File                      | Role                                                                                          |
| -------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `configureDiContext` | `src/di/di.context.ts`    | Registers `logger`, `db`, `ns`, `ps`, `productRepository`, `orderRepository`                  |
| `resolve`            | `src/di/di.context.ts`    | Resolves a service from the Awilix container                                                  |
| `awilixPlugin`       | `src/di/awilix.plugin.ts` | Fastify plugin for Awilix                                                                     |

### Database

| Symbol                                   | File                       | Role                                         |
| ---------------------------------------- | -------------------------- | -------------------------------------------- |
| `products`, `orders`, `ordersToProducts` | `src/db/schema.ts`         | SQLite tables and relations                  |
| `drizzlePlugin`                          | `src/db/drizzle.plugin.ts` | Attaches Drizzle / better-sqlite3 to Fastify |

### Config

| Symbol                | File                           | Role                                               |
| --------------------- | ------------------------------ | -------------------------------------------------- |
| `CONFIG`              | `src/configuration/index.ts`   | Convict config (`PORT`, `DB_URI`, `APP_ENV`, etc.) |
| `dotEnvConvict` setup | `src/configuration/convict.ts` | Loads env file from `CONFIG_PATH`                  |
