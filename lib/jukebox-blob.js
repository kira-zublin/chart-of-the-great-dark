import { del, head } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

// Keeps the Hobby plan's 1 GB of Blob storage comfortably shared across tracks.
export const maxTrackBytes = 15 * 1024 * 1024;

// Vercel Blob calls used by the jukebox. Kept behind one object so tests can
// substitute them without network access.
export const blobStore = {
  configured: () => Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  clientToken: options => generateClientTokenFromReadWriteToken(options),
  head: pathname => head(pathname),
  del: url => del(url)
};
