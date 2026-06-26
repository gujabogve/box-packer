// Domain model. A Project IS a product (e.g. a chair). It owns the part list (BOM), one board
// spec, and a target quantity; its sheets are auto-generated, editable cut layouts.

export interface Piece {
	name: string;
	w: number;
	h: number;
	qty: number;
	color?: string;
}

export interface SheetOptions {
	allowRotate: boolean;
	grow: boolean;
	useKerf: boolean;
	kerf: number;
}

// One placed piece in a saved layout. Mirrors the packer's PackNode so save/restore is a plain clone.
export interface SavedPlacement {
	x: number;
	y: number;
	w: number;
	h: number;
	rw: number;
	rh: number;
	color: string;
	label: string;
	rot: boolean;
}

// A generated board: the parts assigned to it + its saved layout. Board size/options come from the project.
export interface Sheet {
	id: string;
	name: string;
	pieces: Piece[];
	savedLayout: SavedPlacement[] | null;
	savedMethod: string | null;
}

export interface Project {
	id: string;
	name: string;
	notes?: string;
	createdAt: number;
	updatedAt: number;
	parts: Piece[]; // the product's bill of materials (per single product)
	container: { w: number; h: number }; // board size — one per project
	thickness: number;
	options: SheetOptions;
	quantity: number; // how many products to make
	sheets: Sheet[]; // generated layouts
}

export function defaultOptions(): SheetOptions {
	return { allowRotate: true, grow: false, useKerf: false, kerf: 0.3 };
}
