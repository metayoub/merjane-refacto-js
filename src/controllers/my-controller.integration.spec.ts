import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {type FastifyInstance} from 'fastify';
import supertest from 'supertest';
import {eq} from 'drizzle-orm';
import {type DeepMockProxy, mockDeep} from 'vitest-mock-extended';
import {asValue} from 'awilix';
import {type INotificationService} from '@/services/notifications.port.js';
import {
	type ProductInsert,
	products,
	orders,
	ordersToProducts,
} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {buildFastify} from '@/fastify.js';

describe('MyController Integration Tests', () => {
	let fastify: FastifyInstance;
	let database: Database;
	let notificationServiceMock: DeepMockProxy<INotificationService>;

	beforeEach(async () => {
		notificationServiceMock = mockDeep<INotificationService>();

		fastify = await buildFastify();
		fastify.diContainer.register({
			ns: asValue(notificationServiceMock as INotificationService),
		});
		await fastify.ready();
		database = fastify.database;
	});
	afterEach(async () => {
		await fastify.close();
	});

	it('ProcessOrderShouldReturn', async () => {
		const client = supertest(fastify.server);
		const allProducts = createProducts();
		const orderId = database.transaction(tx => {
			const productList = tx.insert(products).values(allProducts).returning({productId: products.id}).all();
			const order = tx.insert(orders).values([{}]).returning({orderId: orders.id}).get();
			tx.insert(ordersToProducts).values(productList.map(p => ({orderId: order!.orderId, productId: p.productId}))).run();
			return order!.orderId;
		});

		await client.post(`/orders/${orderId}/processOrder`).expect(200).expect('Content-Type', /application\/json/);

		const resultOrder = await database.query.orders.findFirst({where: eq(orders.id, orderId)});
		expect(resultOrder!.id).toBe(orderId);
	});

	// ISSUE-001: missing order must not crash; must return 404 and not mutate products
	it('returns 404 when the order does not exist and leaves products untouched', async () => {
		const client = supertest(fastify.server);
		const createdProductId = database.transaction(tx => {
			const inserted = tx.insert(products).values([{
				leadTime: 15, available: 30, type: 'NORMAL', name: 'USB Cable',
			}]).returning({productId: products.id}).get();
			return inserted!.productId;
		});

		await client.post('/orders/999999/processOrder').expect(404);

		const product = await database.query.products.findFirst({where: eq(products.id, createdProductId)});
		expect(product!.available).toBe(30);
	});

	// ISSUE-001: invalid orderId values must be rejected with 400 (Zod validation)
	it('returns 400 for a negative orderId', async () => {
		const client = supertest(fastify.server);
		await client.post('/orders/-1/processOrder').expect(400);
	});

	it('returns 400 for a non-integer orderId', async () => {
		const client = supertest(fastify.server);
		await client.post('/orders/1.5/processOrder').expect(400);
	});

	// ISSUE-002: processOrder must be atomic; a failure mid-processing must roll back
	// earlier stock decrements.
	it('rolls back earlier stock updates when processing fails mid-order', async () => {
		const client = supertest(fastify.server);
		const d = 24 * 60 * 60 * 1000;
		const {normalProductId, orderId} = database.transaction(tx => {
			const inserted = tx.insert(products).values([
				{
					leadTime: 15, available: 5, type: 'NORMAL', name: 'USB Cable',
				},
				{
					leadTime: 15,
					available: 30,
					type: 'SEASONAL',
					name: 'Grapes',
					seasonStartDate: new Date(Date.now() + (180 * d)),
					seasonEndDate: new Date(Date.now() + (240 * d)),
				},
			]).returning({productId: products.id}).all();
			const order = tx.insert(orders).values([{}]).returning({orderId: orders.id}).get();
			tx.insert(ordersToProducts).values(inserted.map(p => ({orderId: order!.orderId, productId: p.productId}))).run();
			return {normalProductId: inserted[0]!.productId, orderId: order!.orderId};
		});

		// The out-of-season SEASONAL product triggers sendOutOfStockNotification.
		// Make that throw AFTER the NORMAL product has already been decremented.
		notificationServiceMock.sendOutOfStockNotification.mockImplementation(() => {
			throw new Error('notification failure');
		});

		await client.post(`/orders/${orderId}/processOrder`).expect(500);

		// Proves we reached the second (SEASONAL) product after decrementing the first.
		expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalled();
		// The NORMAL product decrement must have been rolled back (still 5, not 4).
		const normalProduct = await database.query.products.findFirst({where: eq(products.id, normalProductId)});
		expect(normalProduct!.available).toBe(5);
	});

	function createProducts(): ProductInsert[] {
		const d = 24 * 60 * 60 * 1000;
		return [
			{
				leadTime: 15, available: 30, type: 'NORMAL', name: 'USB Cable',
			},
			{
				leadTime: 10, available: 0, type: 'NORMAL', name: 'USB Dongle',
			},
			{
				leadTime: 15, available: 30, type: 'EXPIRABLE', name: 'Butter', expiryDate: new Date(Date.now() + (26 * d)),
			},
			{
				leadTime: 90, available: 6, type: 'EXPIRABLE', name: 'Milk', expiryDate: new Date(Date.now() - (2 * d)),
			},
			{
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Watermelon', seasonStartDate: new Date(Date.now() - (2 * d)), seasonEndDate: new Date(Date.now() + (58 * d)),
			},
			{
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Grapes', seasonStartDate: new Date(Date.now() + (180 * d)), seasonEndDate: new Date(Date.now() + (240 * d)),
			},
		];
	}
});
