import { useCallback, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

// Speaking instead of typing.
//
// On iOS this is SFSpeechRecognizer, and the reason it is worth a native
// module rather than a recording uploaded somewhere is that her words here are
// health information. requiresOnDeviceRecognition keeps the audio and the
// transcription on the phone: nothing is sent to Apple, and nothing is sent to
// us except the text she chooses to keep. A cloud transcription service would
// have meant her describing her symptoms to a third party before Ciatta had
// even asked her to sign in.
//
// Dictation appends rather than replaces. She may type a sentence, speak the
// next, and correct both; a recogniser that overwrote the field on each result
// would quietly destroy what she had already written.

export type DictationState = {
  listening: boolean;
  // Non empty only while listening: the recogniser's current best guess,
  // shown greyed so she can see it is not committed yet.
  partial: string;
  // Set when dictation could not run. Short, already fit for the screen, and
  // never the raw error: those carry device and locale detail she has no use
  // for.
  error: string;
  start: () => Promise<void>;
  stop: () => void;
};

export function useDictation(onCommit: (text: string) => void): DictationState {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState('');
  // The last transcript seen, kept in a ref so the end handler can commit it
  // without the event stream having to deliver it twice.
  const latest = useRef('');

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results?.[0]?.transcript ?? '';
    latest.current = text;
    // isFinal arrives at the end of an utterance. Until then the text is a
    // guess that can still change, so it is shown but not committed.
    if (e.isFinal) {
      if (text.trim()) onCommit(text.trim());
      latest.current = '';
      setPartial('');
    } else {
      setPartial(text);
    }
  });

  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    setPartial('');
    // 'aborted' is her own stop, not a failure, and must not be shown as one.
    if (e.error === 'aborted') return;
    setError(
      e.error === 'not-allowed'
        ? 'Dictation needs permission for speech and the microphone. You can turn those on in Settings.'
        : 'Dictation did not work that time. You can type instead.',
    );
  });

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    // A final result does not always arrive before end, in which case the last
    // partial is the best record of what she said, and dropping it would lose
    // the sentence she just spoke.
    const tail = latest.current.trim();
    if (tail) onCommit(tail);
    latest.current = '';
    setPartial('');
  });

  const start = useCallback(async () => {
    setError('');
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Dictation needs permission for speech and the microphone. You can type instead.');
        return;
      }
      latest.current = '';
      setPartial('');
      setListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        // Shows words as she says them, which is what makes dictation feel
        // like it is listening rather than like a form that submits.
        interimResults: true,
        // Keeps the audio and the recognition on the device. See the note at
        // the top: this is the whole reason for the native module.
        requiresOnDeviceRecognition: true,
        continuous: false,
      });
    } catch {
      setListening(false);
      setError('Dictation is not available on this device. You can type instead.');
    }
  }, []);

  const stop = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // stop() on an already stopped recogniser is not a failure worth
      // showing her; the end event will settle the state either way.
    }
    setListening(false);
  }, []);

  return { listening, partial, error, start, stop };
}
