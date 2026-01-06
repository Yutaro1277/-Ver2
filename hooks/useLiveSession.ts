import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { SessionStatus, TranscriptItem, MeetingMinutes, LiveSessionHook } from '../types';
import { createPcmBlob, decodeAudioData, base64ToArrayBuffer, resampleBuffer } from '../utils/audio';

// System instruction for the "Live" persona - a silent scribe.
// Strongly instruct the model not to speak.
const LIVE_SYSTEM_INSTRUCTION = `
あなたは「沈黙の書記」です。
ユーザーの発言を一切遮らず、返事も相槌も打たないでください。
音声での応答は絶対にしないでください。
あなたの唯一のタスクは、入力された音声を内部で聞き取り、文脈を理解することです。
私（ユーザー）が何を言っても、無言を貫いてください。
`;

export const useLiveSession = (): LiveSessionHook => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup and state tracking inside callbacks
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  // const outputContextRef = useRef<AudioContext | null>(null); // No longer needed as we don't play AI audio
  
  // Audio buffering to prevent flooding the websocket
  const audioAccumulatorRef = useRef<Float32Array>(new Float32Array(0));
  
  // Track pause state in a Ref for immediate access inside audio callbacks
  const isPausedRef = useRef<boolean>(false);

  // Accumulate text for the "current turn"
  const currentTurnRef = useRef<{ user: string }>({ user: '' });

  const disconnect = useCallback(() => {
    console.log("Disconnecting session...");
    
    // 1. Close session
    try {
      if (sessionRef.current) {
        sessionRef.current.close();
      }
    } catch (e) {
      console.warn("Error closing session:", e);
    }
    sessionRef.current = null;

    // 2. Stop audio tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // 3. Disconnect Audio Nodes
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // 4. Close Audio Contexts
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
         audioContextRef.current.close().catch(console.error);
      }
      audioContextRef.current = null;
    }
    // Output context is removed

    isPausedRef.current = false;
    audioAccumulatorRef.current = new Float32Array(0);

    // Only update status if we were active
    setStatus((prev) => (prev === SessionStatus.RECORDING || prev === SessionStatus.PAUSED) ? SessionStatus.COMPLETED : prev);
    setVolume(0);
  }, []);

  const pause = useCallback(() => {
    if (status === SessionStatus.RECORDING) {
      isPausedRef.current = true;
      setStatus(SessionStatus.PAUSED);
      setVolume(0); // Reset visualizer
    }
  }, [status]);

  const resume = useCallback(() => {
    if (status === SessionStatus.PAUSED) {
      isPausedRef.current = false;
      setStatus(SessionStatus.RECORDING);
    }
  }, [status]);

  const connect = useCallback(async () => {
    try {
      if (!process.env.API_KEY) {
          throw new Error("API Keyが設定されていません。");
      }

      setStatus(SessionStatus.CONNECTING);
      setError(null);
      isPausedRef.current = false;
      audioAccumulatorRef.current = new Float32Array(0);

      // Initialize API
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Setup Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass();
      
      // Ensure context is running
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      audioContextRef.current = inputCtx;

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true
        } 
      });
      mediaStreamRef.current = stream;

      const source = inputCtx.createMediaStreamSource(stream);
      // Use buffer size 0 to let browser choose best value
      const processor = inputCtx.createScriptProcessor(0, 1, 1);
      processorRef.current = processor;

      // Start Session
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO], // API requirement, even if we ignore output
          systemInstruction: LIVE_SYSTEM_INSTRUCTION,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          inputAudioTranscription: {}, 
          // We don't need output transcription since AI shouldn't speak
          outputAudioTranscription: {}, 
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            setStatus(SessionStatus.RECORDING);
            
            // Audio Process Logic
            processor.onaudioprocess = (e) => {
              // Check if paused - if so, do nothing
              if (isPausedRef.current) return;

              const inputData = e.inputBuffer.getChannelData(0);
              const inputSampleRate = inputCtx.sampleRate;
              
              // Calculate volume for visualizer
              let sum = 0;
              for(let i=0; i<inputData.length; i+=10) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / (inputData.length/10));
              setVolume(Math.min(rms * 10, 1)); 

              // High-quality Resampling to 16kHz
              const resampledData = resampleBuffer(inputData, inputSampleRate, 16000);
              
              // Buffer accumulator logic
              const newBuffer = new Float32Array(audioAccumulatorRef.current.length + resampledData.length);
              newBuffer.set(audioAccumulatorRef.current);
              newBuffer.set(resampledData, audioAccumulatorRef.current.length);
              audioAccumulatorRef.current = newBuffer;

              // Send every ~128ms (2048 samples)
              if (audioAccumulatorRef.current.length >= 2048) {
                  const chunkToSend = audioAccumulatorRef.current;
                  audioAccumulatorRef.current = new Float32Array(0); // Reset buffer

                  const pcmBlob = createPcmBlob(chunkToSend);
                  sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
              }
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle User Transcriptions ONLY
            const inputTx = message.serverContent?.inputTranscription?.text;
            
            // Ignore output transcription (AI speaking)
            // const outputTx = message.serverContent?.outputTranscription?.text; 

            if (inputTx) {
              currentTurnRef.current.user += inputTx;

              setTranscript(prev => {
                const newHistory = [...prev];
                const last = newHistory[newHistory.length - 1];
                
                // Update existing partial user turn or create new one
                if (last && last.role === 'user' && last.isPartial) {
                    last.text = currentTurnRef.current.user;
                } else {
                    newHistory.push({
                    id: Date.now().toString(),
                    role: 'user',
                    text: currentTurnRef.current.user,
                    timestamp: new Date(),
                    isPartial: true
                    });
                }
                return newHistory;
              });
            }

            if (message.serverContent?.turnComplete) {
               setTranscript(prev => {
                  return prev.map(item => ({ ...item, isPartial: false }));
               });
               currentTurnRef.current = { user: '' };
            }

            // COMPLETELY IGNORE AI AUDIO OUTPUT
            // We do not decode or play back any audio from the model.
            // This turns the app into a passive recorder.
          },
          onclose: (e) => {
            console.log("Gemini Live Closed", e);
            setStatus((prev) => {
                if (prev === SessionStatus.RECORDING || prev === SessionStatus.PAUSED) {
                     disconnect(); 
                     return SessionStatus.COMPLETED;
                }
                return prev;
            });
          },
          onerror: (err: any) => {
            console.error("Gemini Live Error", err);
            let errMsg = "接続エラーが発生しました。";
            if (err instanceof Error) {
                errMsg += ` (${err.message})`;
            } else {
                errMsg += " (通信が切断されました - ネットワーク環境を確認して再試行してください)";
            }
            setError(errMsg);
            disconnect();
            setStatus(SessionStatus.ERROR);
          }
        }
      });
      
      sessionRef.current = await sessionPromise;

    } catch (e: any) {
      console.error(e);
      let msg = e.message || "セッションの開始に失敗しました。";
      if (msg.includes("GetUserMedia")) {
          msg = "マイクへのアクセスが拒否されました。設定を確認してください。";
      }
      setError(msg);
      setStatus(SessionStatus.ERROR);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generateMinutes = async (): Promise<MeetingMinutes | null> => {
    // Combine full transcript (User only)
    const fullText = transcript
        .filter(t => t.text.trim() !== '') // Filter empty
        .map(t => `発言者: ${t.text}`)
        .join('\n');
    
    if (!fullText.trim()) return null;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `
        以下の会議の文字起こしを分析し、構造化された議事録を生成してください。
        
        文字起こし:
        ${fullText}
        `,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "会議の簡潔なタイトル" },
              date: { type: Type.STRING, description: "会議の日付 (YYYY-MM-DD) または '不明'" },
              attendees: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING }, 
                description: "文字起こしから推測される参加者リスト（例: Aさん, Bさん）" 
              },
              summary: { type: Type.STRING, description: "包括的なエグゼクティブサマリー (約200文字)" },
              topics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    details: { type: Type.STRING }
                  },
                  required: ["title", "details"]
                }
              },
              decisions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "決定事項" },
              actionItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    assignee: { type: Type.STRING },
                    task: { type: Type.STRING },
                    dueDate: { type: Type.STRING, description: "期限があれば記載、なければ '未定'" }
                  },
                  required: ["assignee", "task"]
                }
              }
            },
            required: ["title", "summary", "topics", "decisions", "actionItems"]
          }
        }
      });

      const json = JSON.parse(response.text || "{}");
      return json as MeetingMinutes;
    } catch (e) {
      console.error("Generation failed", e);
      setError("議事録の生成に失敗しました。");
      return null;
    }
  };

  return {
    status,
    transcript,
    volume,
    connect,
    disconnect,
    pause,
    resume,
    generateMinutes,
    error
  };
};