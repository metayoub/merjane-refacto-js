import {type Cradle, diContainer} from '@fastify/awilix';
import {asClass, asFunction, asValue} from 'awilix';
import {type FastifyBaseLogger, type FastifyInstance} from 'fastify';
import {type INotificationService} from '@/services/notifications.port.js';
import {NotificationService} from '@/services/impl/notification.service.js';
import {type Database} from '@/db/type.js';
import {ProductService} from '@/services/impl/product.service.js';
import {ProductRepository} from '@/repositories/product.repository.js';
import {OrderRepository} from '@/repositories/order.repository.js';

declare module '@fastify/awilix' {

	interface Cradle { // eslint-disable-line @typescript-eslint/consistent-type-definitions
		logger: FastifyBaseLogger;
		db: Database;
		ns: INotificationService;
		ps: ProductService;
		productRepository: ProductRepository;
		orderRepository: OrderRepository;
	}
}

export async function configureDiContext(
	server: FastifyInstance,
): Promise<void> {
	diContainer.register({
		logger: asValue(server.log),
	});
	diContainer.register({
		db: asValue(server.database),
	});
	diContainer.register({
		ns: asClass(NotificationService),
	});
	diContainer.register({
		productRepository: asFunction(({db}: Pick<Cradle, 'db'>) => new ProductRepository(db)).singleton(),
		orderRepository: asFunction(({db}: Pick<Cradle, 'db'>) => new OrderRepository(db)).singleton(),
	});
	diContainer.register({
		ps: asClass(ProductService),
	});
}

export function resolve<Service extends keyof Cradle>(
	service: Service,
): Cradle[Service] {
	return diContainer.resolve(service);
}
