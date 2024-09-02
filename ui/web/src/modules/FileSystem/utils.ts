export const bs64toBlob = (b64Data: string, contentType = '', sliceSize = 512) => {
  const byteCharacters = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: contentType });
  return blob;
};

export function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).replace(/^.+;base64,/, ''));
    reader.readAsDataURL(blob);
  });
}

export const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise<string>((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

export const dataURLToBlob = (dataURL: string): Promise<Blob> => {
  return fetch(dataURL).then((res) => res.blob());
};
