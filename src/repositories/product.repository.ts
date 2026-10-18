import {
	and, eq, gt, sql,
} from 'drizzle-orm';
import {products} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {Product} from '@/domain/product.js';

export class ProductRepository {
	public constructor(private readonly database: Database) {}

	public async findById(id: number): Promise<Product | undefined> {
		const row = await this.database.query.products.findFirst({
			where: eq(products.id, id),
		});
		return row ? Product.fromRow(row) : undefined;
	}

	/** Decrements if available > 0; returns whether a row was updated. */
	public async decrementStock(productId: number): Promise<boolean> {
		const result = await this.database.update(products)
			.set({available: sql`${products.available} - 1`})
			.where(and(eq(products.id, productId), gt(products.available, 0)));
		return (result.changes ?? 0) > 0;
	}

	public async updateAvailable(productId: number, available: number): Promise<void> {
		await this.database.update(products)
			.set({available})
			.where(eq(products.id, productId));
	}

	public async updateLeadTime(productId: number, leadTime: number): Promise<void> {
		await this.database.update(products)
			.set({leadTime})
			.where(eq(products.id, productId));
	}
}
