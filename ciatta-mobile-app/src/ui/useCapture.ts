// Scan a paper document, upload a PDF, or choose a photo: one file, as
// base64, handed to whoever asked. The same three ways in as lab reports.

import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { isScannerAvailable, scanDocument } from '../../modules/document-scanner';

export type Captured = { base64: string; kind: 'image' | 'pdf' };

export function useCapture(onFile: (f: Captured) => void) {
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const canScan = isScannerAvailable();

  const scan = async () => {
    if (scanning) return;
    setScanning(true);
    setNote(null);
    try {
      const scanned = await scanDocument();
      if (scanned) onFile({ base64: await new File(scanned.uri).base64(), kind: 'pdf' });
    } catch {
      setNote('The scan did not open. Try again.');
    } finally {
      setScanning(false);
    }
  };

  const pdf = async () => {
    setNote(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.length) return;
      onFile({ base64: await new File(picked.assets[0].uri).base64(), kind: 'pdf' });
    } catch {
      setNote('That PDF did not open.');
    }
  };

  const photo = async () => {
    setNote(null);
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (picked.canceled || !picked.assets?.length) return;
      const ref = await ImageManipulator.manipulate(picked.assets[0].uri).resize({ width: 1800 }).renderAsync();
      const out = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
      if (out.base64) onFile({ base64: out.base64, kind: 'image' });
    } catch {
      setNote('That photo did not open.');
    }
  };

  return { canScan, scanning, scan, pdf, photo, note };
}
