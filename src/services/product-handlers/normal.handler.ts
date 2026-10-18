import {type ProcessContext, type ProductHandler} from './product-handler.js';
import {type Product} from '@/domain/product.js';

export class NormalProductHandler implements ProductHandler {
	public async process(product: Product, context: ProcessContext): Promise<void> {
		if (product.hasStock()) {
			const decremented = await context.products.decrementStock(product.id);
			if (decremented) {
				return;
			}
		}

		await this.announceDelay(product, context);
	}

	private async announceDelay(product: Product, {notifications, products}: ProcessContext): Promise<void> {
		await products.updateLeadTime(product.id, product.leadTime);
		notifications.sendDelayNotification(product.leadTime, product.name);
	}
}
