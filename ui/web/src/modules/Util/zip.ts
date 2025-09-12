import { BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js';

export const ZIP = {
  read: async (zipFileBlob: Blob) => {
    const zipFileReader = new BlobReader(zipFileBlob);
    const zipReader = new ZipReader(zipFileReader);
    const entries = await zipReader.getEntries();

    const data: {
      filename: string;
      blob: Blob;
      isDirectory: boolean;
      isFile: boolean;
    }[] = [];
    for (const entry of entries) {
      if (entry.directory) {
        data.push({
          filename: entry.filename,
          blob: new Blob(),
          isDirectory: true,
          isFile: false,
        });
      } else {
        data.push({
          filename: entry.filename,
          blob: await entry.getData(new BlobWriter()),
          isDirectory: false,
          isFile: true,
        });
      }
    }

    await zipReader.close();
    return data;
  },
};
