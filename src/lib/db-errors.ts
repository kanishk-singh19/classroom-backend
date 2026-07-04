// Drizzle (neon-http) wraps the underlying Postgres error inside `cause`, so the
// pg SQLSTATE code can live one level down. Check both spots.
function pgCode(e: any): string | undefined {
    return e?.code ?? e?.cause?.code;
}

// 23505 = unique_violation
export function isUniqueViolation(e: unknown): boolean {
    return pgCode(e) === '23505';
}

// 23503 = foreign_key_violation
export function isForeignKeyViolation(e: unknown): boolean {
    return pgCode(e) === '23503';
}
