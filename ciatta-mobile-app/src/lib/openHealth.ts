// Opens the Health app, where iOS keeps which data each app may read. An
// app cannot change those permissions itself. Falls back to Ciatta's own
// page in Settings if Health cannot be opened.
import { Linking } from 'react-native';

export async function openAppleHealth(): Promise<void> {
  try {
    await Linking.openURL('x-apple-health://');
  } catch {
    await Linking.openSettings().catch(() => {});
  }
}
