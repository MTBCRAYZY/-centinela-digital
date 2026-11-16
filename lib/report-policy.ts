// Leave room for multipart headers under Vercel's 4.5 MB request limit.
export const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;
export const MAX_EVIDENCE_FILES = 5;
export const MAX_UPLOAD_BYTES = MAX_EVIDENCE_BYTES + 64 * 1024;
