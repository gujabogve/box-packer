// Domain model persisted to IndexedDB. Project → Sheet → Piece.

export interface Piece {
	name: string;
	w: number;
	h: number;
	qty: number;
}

export interface SheetOptions {
	allowRotate: boolean;
	grow: boolean;
	useKerf: boolean;
	kerf: number;
}

// One placed piece in a saved (auto-picked or hand-tweaked) layout.
// Mirrors the packer's PackNode so save/restore is a plain clone.
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

export interface Sheet {
	id: string;
	name: string;
	container: { w: number; h: number };
	thickness: number;
	options: SheetOptions;
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
	sheets: Sheet[];
}

export function defaultOptions(): SheetOptions {
	return { allowRotate: true, grow: false, useKerf: false, kerf: 0.3 };
}
