import {sql} from 'drizzle-orm';
import fastifyPlugin from 'fastify-plugin';
import {serializerCompiler, validatorCompiler, type ZodTypeProvider} from 'fastify-type-provider-zod';
import {z} from 'zod';

/** HTTP: validate params, load order, transaction + ProductService.process per line. */
export const myController = fastifyPlugin(async server => {
	server.setValidatorCompiler(validatorCompiler);
	server.setSerializerCompiler(serializerCompiler);

	server.withTypeProvider<ZodTypeProvider>().post('/orders/:orderId/processOrder', {
		schema: {
			params: z.object({
				orderId: z.coerce.number().int().positive(),
			}),
		},
	}, async (request, reply) => {
		const database = server.diContainer.resolve('db');
		const productService = server.diContainer.resolve('ps');
		const orders = server.diContainer.resolve('orderRepository');

		const order = await orders.findWithProducts(request.params.orderId);
		if (!order) {
			return reply.code(404).send({message: 'Order not found'});
		}

		database.run(sql`BEGIN`);
		try {
			for (const product of order.products) {
				// eslint-disable-next-line no-await-in-loop -- one transaction, sequential lines
				await productService.process(product);
			}

			database.run(sql`COMMIT`);
		} catch (error) {
			database.run(sql`ROLLBACK`);
			throw error;
		}

		return reply.send({orderId: order.id});
	});
});
