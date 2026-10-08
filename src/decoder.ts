import { prepareZXingModule, readBarcodes, type ReaderOptions } from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

// Serve the decoder WASM from our own origin (precached by the service worker)
// instead of the default CDN, so scanning works offline.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
  },
})

const OPTIONS: ReaderOptions = {
  formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'],
  tryHarder: true,
  maxNumberOfSymbols: 1,
}

export async function decodeBarcode(source: ImageData | Blob): Promise<string | null> {
  const results = await readBarcodes(source, OPTIONS)
  const hit = results.find((r) => r.isValid)
  return hit ? hit.text : null
}
