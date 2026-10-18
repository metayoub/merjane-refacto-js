import {type Product as ProductRow} from '@/db/schema.js';

export type ProductType = 'NORMAL' | 'SEASONAL' | 'EXPIRABLE';

const dayMs = 1000 * 60 * 60 * 24;

/** Domain product: stock / season / expiry helpers over the DB row. */
export class Product {
	public static fromRow(row: ProductRow): Product {
		return new Product({...row});
	}

	private constructor(private readonly row: ProductRow) {}

	public get id(): number {
		return this.row.id;
	}

	public get name(): string {
		return this.row.name;
	}

	public get type(): ProductType {
		return this.row.type as ProductType;
	}

	public get available(): number {
		return this.row.available;
	}

	public get leadTime(): number {
		return this.row.leadTime;
	}

	public get expiryDate(): Date | undefined {
		return this.row.expiryDate ?? undefined;
	}

	public get seasonStartDate(): Date | undefined {
		return this.row.seasonStartDate ?? undefined;
	}

	public get seasonEndDate(): Date | undefined {
		return this.row.seasonEndDate ?? undefined;
	}

	public hasStock(): boolean {
		return this.row.available > 0;
	}

	public isExpired(now: Date = new Date()): boolean {
		if (!this.row.expiryDate) {
			return false;
		}

		return this.row.expiryDate <= now;
	}

	public isInSeason(now: Date = new Date()): boolean {
		const {seasonStartDate, seasonEndDate} = this.row;
		if (!seasonStartDate || !seasonEndDate) {
			return false;
		}

		return now >= seasonStartDate && now < seasonEndDate;
	}

	public isBeforeSeason(now: Date = new Date()): boolean {
		if (!this.row.seasonStartDate) {
			return false;
		}

		return now < this.row.seasonStartDate;
	}

	public isAfterSeason(now: Date = new Date()): boolean {
		if (!this.row.seasonEndDate) {
			return false;
		}

		return now >= this.row.seasonEndDate;
	}

	public restockDate(now: Date = new Date()): Date {
		return new Date(now.getTime() + (this.row.leadTime * dayMs));
	}

	public isRestockWithinSeason(now: Date = new Date()): boolean {
		if (!this.row.seasonEndDate) {
			return false;
		}

		return this.restockDate(now) <= this.row.seasonEndDate;
	}

	public withAvailable(available: number): Product {
		return Product.fromRow({...this.row, available});
	}

	public toRow(): ProductRow {
		return {...this.row};
	}
}
