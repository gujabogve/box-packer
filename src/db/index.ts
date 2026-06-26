import Dexie, { type Table } from 'dexie';
import type { Project } from '../lib/types';

// Single object store keyed by project id. Sheets are nested inside the project document —
// the dataset is small, so a document-per-project model keeps reads/writes trivial.
// A `stock` table for inventory tracking will be added in a later version.
class BoxPackerDB extends Dexie {
	projects!: Table<Project, string>;

	constructor() {
		super('box-packer');
		this.version(1).stores({
			projects: 'id, name, updatedAt',
		});
	}
}

export const db = new BoxPackerDB();
