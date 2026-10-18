/* eslint-disable @typescript-eslint/switch-exhaustiveness-check */
/* eslint-disable max-depth */
/* eslint-disable no-await-in-loop */
import {
	and, eq, gt, sql,
} from 'drizzle-orm';
import fastifyPlugin from 'fastify-plugin';
import {serializerCompiler, validatorCompiler, type ZodTypeProvider} from 'fastify-type-provider-zod';
import {z} from 'zod';
import {orders, products} from '@/db/schema.js';

export const myController = fastifyPlugin(async server => {
	// Add schema validator and serializer
	server.setValidatorCompiler(validatorCompiler);
	server.setSerializerCompiler(serializerCompiler);

	server.withTypeProvider<ZodTypeProvider>().post('/orders/:orderId/processOrder', {
		schema: {
			params: z.object({
				// ISSUE-001: constrain orderId to a positive integer so malformed ids are
				// rejected with 400 before any processing happens.
				orderId: z.coerce.number().int().positive(),
			}),
		},
	}, async (request, reply) => {
		const dbse = server.diContainer.resolve('db');
		const ps = server.diContainer.resolve('ps');
		const order = await dbse.query.orders
			.findFirst({
				where: eq(orders.id, request.params.orderId),
				with: {
					products: {
						columns: {},
						with: {
							product: true,
						},
					},
				},
			});

		// ISSUE-001: a missing order must not crash the handler. Return 404 instead of
		// force-unwrapping an undefined order.
		if (!order) {
			return reply.code(404).send({message: 'Order not found'});
		}

		const {products: productList} = order;

		// ISSUE-002: process the whole order inside a single transaction so that a
		// failure part-way through rolls back every stock update (all-or-nothing).
		// drizzle's better-sqlite3 transaction wrapper is synchronous and cannot await
		// the async ProductService methods, so we manage the transaction explicitly on
		// the shared connection. `ps` uses the same connection, so its writes join this
		// transaction automatically.
		dbse.run(sql`BEGIN`);
		try {
			if (productList) {
				for (const {product: p} of productList) {
					switch (p.type) {
						case 'NORMAL': {
							if (p.available > 0) {
								// ISSUE-002: conditional decrement guards against overselling.
								await dbse.update(products)
									.set({available: sql`${products.available} - 1`})
									.where(and(eq(products.id, p.id), gt(products.available, 0)));
							} else {
								const {leadTime} = p;
								if (leadTime > 0) {
									await ps.notifyDelay(leadTime, p);
								}
							}

							break;
						}

						case 'SEASONAL': {
							const currentDate = new Date();
							if (currentDate > p.seasonStartDate! && currentDate < p.seasonEndDate! && p.available > 0) {
								await dbse.update(products)
									.set({available: sql`${products.available} - 1`})
									.where(and(eq(products.id, p.id), gt(products.available, 0)));
							} else {
								await ps.handleSeasonalProduct(p);
							}

							break;
						}

						case 'EXPIRABLE': {
							const currentDate = new Date();
							if (p.available > 0 && p.expiryDate! > currentDate) {
								await dbse.update(products)
									.set({available: sql`${products.available} - 1`})
									.where(and(eq(products.id, p.id), gt(products.available, 0)));
							} else {
								await ps.handleExpiredProduct(p);
							}

							break;
						}
					}
				}
			}

			dbse.run(sql`COMMIT`);
		} catch (error) {
			dbse.run(sql`ROLLBACK`);
			throw error;
		}

		return reply.send({orderId: order.id});
	});
});

