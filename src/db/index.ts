import Dexie, { type Table } from 'dexie';
import type { Project } from '../lib/types';

// Single object store keyed by project id; each project is a document with nested sheets.
// v2 restructured Project (parts/board/quantity moved up from sheets) — old data is cleared on upgrade.
class BoxPackerDB extends Dexie {
	projects!: Table<Project, string>;

	constructor() {
		super('box-packer');
		this.version(1).stores({ projects: 'id, name, updatedAt' });
		this.version(2)
			.stores({ projects: 'id, name, updatedAt' })
			.upgrade((tx) => tx.table('projects').clear());
	}
}

export const db = new BoxPackerDB();
