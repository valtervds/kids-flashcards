import React, { useState, useRef } from 'react';

// Declaração global para suportar webkitSpeechRecognition
declare global { 
  interface Window { 
    webkitSpeechRecognition?: any; 
    SpeechRecognition?: any; 
  } 
}

interface SpeechRecognitionProps { 
  onResult: (text: string, isFinal: boolean) => void; 
}

export const SpeechRecognition: React.FC<SpeechRecognitionProps> = ({ onResult }) => {
  const [isSupported, setIsSupported] = useState(() => 
    typeof window !== 'undefined' && 
    (!!(window as any).SpeechRecognition || !!window.webkitSpeechRecognition)
  );
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any | null>(null);

  const startRecording = () => {
    if (!isSupported || isRecording) return;
    
    const SpeechRecognition: any = (window as any).SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { 
      setIsSupported(false); 
      return; 
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';
    
    let finalTranscript = '';
    recognition.onresult = (event: any) => {
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          const partialTranscript = (finalTranscript + result[0].transcript).trim();
          setTranscript(partialTranscript);
          onResult(partialTranscript, false);
        }
      }
    };
    
    recognition.onend = () => { 
      setIsRecording(false); 
      const output = (finalTranscript || transcript).trim(); 
      if (output) onResult(output, true); 
    };
    
    recognition.onerror = (event: any) => {
      setError(`Erro no reconhecimento: ${event.error}`);
      setIsRecording(false);
    };
    
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    setError(null);
  };

  const stopRecording = () => { 
    try { 
      recognitionRef.current?.stop(); 
    } catch { 
      /* noop */ 
    } 
  };

  return (
    <div className="inline" style={{ gap: 8, alignItems: 'center' }}>
      {isSupported ? (
        <>
          <button 
            className={`btn ${isRecording ? 'btn-danger' : 'btn-secondary'}`}
            type="button" 
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? '🛑 Parar' : '🎤 Falar'}
          </button>
          {transcript && <span className="caption">{transcript}</span>}
          {error && <span className="caption" style={{ color: '#e67e22' }}>{error}</span>}
        </>
      ) : (
        <span className="caption">Reconhecimento de voz não suportado</span>
      )}
    </div>
  );
};
