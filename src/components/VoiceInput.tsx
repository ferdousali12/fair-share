import { useRef, useState, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ParsedExpense } from '../types';

interface VoiceInputProps {
  onResult: (parsed: ParsedExpense) => void;
}

export default function VoiceInput({ onResult }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [showUnsupported, setShowUnsupported] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const finalTextRef = useRef('');
  const interimTextRef = useRef('');

  const SpeechRecognitionAPI =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  useEffect(() => {
    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
    }
  }, [SpeechRecognitionAPI]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }
  }, []);

  const processTranscript = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setIsProcessing(true);

      try {
        // Call the server-side Edge Function which has the Featherless API key
        const { data, error } = await supabase.functions.invoke('parse-expense', {
          body: { transcript: trimmed },
        });

        if (error) throw error;

        const parsed: ParsedExpense = {
          amount: data.amount ?? null,
          category: data.category || 'other',
          note: data.note || trimmed,
          splitType: data.splitType === 'usage' ? 'usage' : 'equal',
          scope:
            data.scope === 'personal'
              ? 'individual'
              : data.scope === 'collective'
              ? 'collective'
              : 'individual',
          usageAmount: data.usageAmount ?? undefined,
          usageUnit: (data.usageUnit ?? undefined) as ParsedExpense['usageUnit'],
        };
        onResult(parsed);
      } catch (err) {
        console.error('AI parse failed, using regex fallback:', err);
        // Fallback to regex parser
        const { parseExpenseInput } = await import('../utils/parser');
        const parsed = parseExpenseInput(trimmed);
        onResult(parsed);
      } finally {
        setIsProcessing(false);
      }
    },
    [onResult]
  );

  const stopAndSubmit = useCallback(() => {
    stopRecognition();
    setIsListening(false);

    const fullText = (finalTextRef.current + ' ' + interimTextRef.current).trim();
    if (fullText) {
      processTranscript(fullText);
    }

    setTimeout(() => {
      setFinalText('');
      setInterimText('');
      finalTextRef.current = '';
      interimTextRef.current = '';
    }, 2000);
  }, [stopRecognition, processTranscript]);

  const stopAndDiscard = useCallback(() => {
    stopRecognition();
    setIsListening(false);
    setFinalText('');
    setInterimText('');
    finalTextRef.current = '';
    interimTextRef.current = '';
  }, [stopRecognition]);

  // ── Speech recognition setup (FIXED: added error logging + en-US) ──
  useEffect(() => {
    if (!isSupported || !SpeechRecognitionAPI) return;

    if (isListening) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US'; // changed from 'en-IN'

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        if (final) {
          finalTextRef.current = (finalTextRef.current + ' ' + final).trim();
          setFinalText(finalTextRef.current);
        }
        interimTextRef.current = interim;
        setInterimText(interim);
      };

      recognition.onerror = (event: any) => {
        console.error('[VoiceInput] SpeechRecognition error:', event.error);
        setIsListening(false);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setShowUnsupported(true);
          setTimeout(() => setShowUnsupported(false), 3000);
        }
      };

      recognition.onend = () => {
        console.log('[VoiceInput] SpeechRecognition ended');
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } else {
      stopRecognition();
    }

    return () => stopRecognition();
  }, [isListening, isSupported, SpeechRecognitionAPI, stopRecognition]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isListening) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const hasText = finalTextRef.current || interimTextRef.current;
      if (e.key === 'Enter' && hasText) {
        e.preventDefault();
        stopAndSubmit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        stopAndDiscard();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isListening, stopAndSubmit, stopAndDiscard]);

  const toggleListening = useCallback(() => {
    if (!isSupported) {
      setShowUnsupported(true);
      setTimeout(() => setShowUnsupported(false), 3000);
      return;
    }
    if (isListening) {
      stopAndSubmit();
    } else {
      setFinalText('');
      setInterimText('');
      finalTextRef.current = '';
      interimTextRef.current = '';
      setIsListening(true);
    }
  }, [isSupported, isListening, stopAndSubmit]);

  const displayText = finalText + ' ' + interimText;
  const hasText = displayText.trim().length > 0;

  return (
    <>
      {isListening && !isProcessing && (
        <div className="fixed bottom-52 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-sm text-center">
          <p className="text-sm text-green-900 bg-white/90 rounded-xl px-4 py-2 shadow-card mb-2">
            {displayText.trim() || 'Listening...'}
          </p>
          <div className="flex items-center justify-center gap-1 h-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 bg-accent rounded-full animate-waveform"
                style={{
                  animationDelay: `${i * 0.12}s`,
                  animationDuration: `${0.6 + Math.random() * 0.3}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {isListening && hasText && !isProcessing && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3">
          <button
            onClick={stopAndDiscard}
            className="w-11 h-11 rounded-full bg-white border border-border shadow-card flex items-center justify-center hover:bg-muted active:scale-[0.93] transition-all cursor-pointer animate-fade-slide-in"
            aria-label="Discard"
          >
            <MicOff className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={stopAndSubmit}
            className="bg-primary text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 shadow-card hover:bg-primary-hover active:scale-[0.97] transition-all cursor-pointer animate-slide-up"
            aria-label="Done"
          >
            <Mic className="w-4 h-4" /> <span>Done</span>
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-end pb-40 pointer-events-none">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-card animate-slide-up">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <span className="text-sm text-green-900">Parsing with AI...</span>
            </div>
          </div>
        </div>
      )}

      {showUnsupported && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 bg-green-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-card animate-slide-up whitespace-nowrap">
          Voice not supported or mic blocked. Use quick-add instead.
        </div>
      )}

      <button
        onClick={toggleListening}
        disabled={isProcessing}
        className={`fixed z-40 bottom-20 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer disabled:opacity-50 ${
          isListening
            ? 'bg-destructive text-white animate-mic-pulse'
            : 'bg-primary text-white animate-mic-idle hover:bg-primary-hover active:scale-[0.97]'
        }`}
        aria-label={isListening ? 'Stop and confirm' : 'Start voice input'}
      >
        {isProcessing ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : isListening ? (
          <MicOff className="w-6 h-6" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </button>
    </>
  );
}