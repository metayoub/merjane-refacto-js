import {describe, it, expect} from 'vitest';
import {Product} from './product.js';

const dayMs = 24 * 60 * 60 * 1000;

describe('Product', () => {
	it('reports stock presence from available', () => {
		const withStock = Product.fromRow({
			id: 1, leadTime: 5, available: 3, type: 'NORMAL', name: 'Cable',
			expiryDate: null, seasonStartDate: null, seasonEndDate: null,
		});
		const empty = Product.fromRow({
			id: 2, leadTime: 5, available: 0, type: 'NORMAL', name: 'Cable',
			expiryDate: null, seasonStartDate: null, seasonEndDate: null,
		});

		expect(withStock.hasStock()).toBe(true);
		expect(empty.hasStock()).toBe(false);
	});

	it('detects expiry relative to a reference date', () => {
		const now = new Date('2026-06-01T12:00:00.000Z');
		const fresh = Product.fromRow({
			id: 1, leadTime: 5, available: 1, type: 'EXPIRABLE', name: 'Butter',
			expiryDate: new Date(now.getTime() + dayMs), seasonStartDate: null, seasonEndDate: null,
		});
		const expired = Product.fromRow({
			id: 2, leadTime: 5, available: 1, type: 'EXPIRABLE', name: 'Milk',
			expiryDate: new Date(now.getTime() - dayMs), seasonStartDate: null, seasonEndDate: null,
		});

		expect(fresh.isExpired(now)).toBe(false);
		expect(expired.isExpired(now)).toBe(true);
	});

	it('detects in-season window inclusive of start and exclusive of end past', () => {
		const now = new Date('2026-07-01T12:00:00.000Z');
		const product = Product.fromRow({
			id: 1, leadTime: 5, available: 1, type: 'SEASONAL', name: 'Melon',
			expiryDate: null,
			seasonStartDate: new Date('2026-06-01T00:00:00.000Z'),
			seasonEndDate: new Date('2026-08-01T00:00:00.000Z'),
		});

		expect(product.isInSeason(now)).toBe(true);
		expect(product.isInSeason(new Date('2026-05-01T00:00:00.000Z'))).toBe(false);
		expect(product.isInSeason(new Date('2026-09-01T00:00:00.000Z'))).toBe(false);
	});

	it('computes whether restock arrives before season end', () => {
		const now = new Date('2026-07-01T12:00:00.000Z');
		const shortLead = Product.fromRow({
			id: 1, leadTime: 5, available: 0, type: 'SEASONAL', name: 'Melon',
			expiryDate: null,
			seasonStartDate: new Date('2026-06-01T00:00:00.000Z'),
			seasonEndDate: new Date('2026-08-01T00:00:00.000Z'),
		});
		const longLead = Product.fromRow({
			id: 2, leadTime: 90, available: 0, type: 'SEASONAL', name: 'Melon',
			expiryDate: null,
			seasonStartDate: new Date('2026-06-01T00:00:00.000Z'),
			seasonEndDate: new Date('2026-08-01T00:00:00.000Z'),
		});

		expect(shortLead.isRestockWithinSeason(now)).toBe(true);
		expect(longLead.isRestockWithinSeason(now)).toBe(false);
	});
});
