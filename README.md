### Consignes JS:

- Si probleme de version pnpm, utiliser `corepack enable pnpm` qui devrait automatiquement utiliser la bonne version
- Ne pas modifier les classes qui ont un commentaire: `// WARN: Should not be changed during the exercise
`
- Pour lancer les tests: `pnpm test`
  - integration only in watch mode `pnpm test:integration`
  - unit only in watch mode `pnpm test:unit`

# Merjane Refacto (JS)

Order-processing API built with Fastify, Drizzle ORM, and SQLite.

## Available routes

| Method | Path                            | Description                                                                                       |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `POST` | `/orders/:orderId/processOrder` | Process an order: for each product, decrement stock or trigger delay / seasonal / expiry handling |

### `POST /orders/:orderId/processOrder`

- **Params:** `orderId` (number)
- **Response (200):** `{ "orderId": <number> }`
- **Behavior by product `type`:**
  - `NORMAL` — if stock &gt; 0, decrement; else notify delay via `ProductService.notifyDelay`
  - `SEASONAL` — if in season and stock &gt; 0, decrement; else `ProductService.handleSeasonalProduct`
  - `EXPIRABLE` — if not expired and stock &gt; 0, decrement; else `ProductService.handleExpiredProduct`

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

| Symbol         | File                               | Role                                                     |
| -------------- | ---------------------------------- | -------------------------------------------------------- |
| `myController` | `src/controllers/my-controller.ts` | Registers the process-order route and order/product loop |

### Product service (`ProductService`)

| Method                           | Role                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `notifyDelay(leadTime, product)` | Persists lead time and sends a delay notification                                        |
| `handleSeasonalProduct(product)` | Out-of-season / lead-time vs season-end logic; may notify out-of-stock or delay          |
| `handleExpiredProduct(product)`  | Decrements if still valid, otherwise marks unavailable and sends expiration notification |

File: `src/services/impl/product.service.ts`

### Notification service (`NotificationService` / `INotificationService`)

| Method                                                | Role                             |
| ----------------------------------------------------- | -------------------------------- |
| `sendDelayNotification(leadTime, productName)`        | Delay notification (stub)        |
| `sendOutOfStockNotification(productName)`             | Out-of-stock notification (stub) |
| `sendExpirationNotification(productName, expiryDate)` | Expiration notification (stub)   |

Files: `src/services/impl/notification.service.ts`, `src/services/notifications.port.ts`  
_(Marked as exercise-protected — do not change during the refactor.)_

### DI

| Symbol               | File                      | Role                                                                        |
| -------------------- | ------------------------- | --------------------------------------------------------------------------- |
| `configureDiContext` | `src/di/di.context.ts`    | Registers `logger`, `db`, `ns` (NotificationService), `ps` (ProductService) |
| `resolve`            | `src/di/di.context.ts`    | Resolves a service from the Awilix container                                |
| `awilixPlugin`       | `src/di/awilix.plugin.ts` | Fastify plugin for Awilix                                                   |

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
