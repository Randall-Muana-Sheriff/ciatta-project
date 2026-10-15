// Apple's document camera, for scanning a paper lab report: it finds the
// page edges, straightens each page, and takes several pages in one go.
// The pages come back as one PDF in the app's cache, so a scan takes the
// same path as a PDF from a patient portal.
//
// iOS only. Anywhere the native module is missing (Android, web, tests)
// the option is unavailable and scanning returns nothing.

type Native = { isAvailable(): boolean; scan(): Promise<{ uri: string; pages: number } | null> };

function native(): Native | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core');
    return requireOptionalNativeModule<Native>('DocumentScanner');
  } catch {
    return null;
  }
}

export function isScannerAvailable(): boolean {
  try {
    return native()?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

export async function scanDocument(): Promise<{ uri: string; pages: number } | null> {
  const scanner = native();
  if (!scanner) return null;
  return await scanner.scan();
}
