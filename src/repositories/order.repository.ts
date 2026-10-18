import {eq} from 'drizzle-orm';
import {orders} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {Product} from '@/domain/product.js';

export type OrderWithProducts = {
	id: number;
	products: Product[];
};

export class OrderRepository {
	public constructor(private readonly database: Database) {}

	public async findWithProducts(orderId: number): Promise<OrderWithProducts | undefined> {
		const order = await this.database.query.orders.findFirst({
			where: eq(orders.id, orderId),
			with: {
				products: {
					columns: {},
					with: {
						product: true,
					},
				},
			},
		});

		if (!order) {
			return undefined;
		}

		const productList = (order.products ?? []).flatMap(line =>
			line.product ? [Product.fromRow(line.product)] : []);

		return {
			id: order.id,
			products: productList,
		};
	}
}
