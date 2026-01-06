import React, { useEffect, useRef } from 'react';
import { TranscriptItem, SessionStatus } from '../types';

interface LiveViewProps {
  status: SessionStatus;
  transcript: TranscriptItem[];
  volume: number;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onGenerate: () => void;
  error: string | null;
}

const LiveView: React.FC<LiveViewProps> = ({ status, transcript, volume, onStop, onPause, onResume, onGenerate, error }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Visualizer bars
  const bars = 5;
  const renderVisualizer = () => {
    return (
      <div className="flex items-end gap-1 h-8">
        {Array.from({ length: bars }).map((_, i) => {
            // Simple visual effect based on single volume value
            // Randomize slightly to make it look active
            const height = Math.max(4, Math.min(100, (volume * 100) * (0.5 + Math.random()))); 
            return (
                <div 
                    key={i} 
                    className={`w-1.5 rounded-full transition-all duration-75 ${status === SessionStatus.PAUSED ? 'bg-amber-300' : 'bg-brand-500'}`}
                    style={{ height: `${status === SessionStatus.RECORDING ? height : 4}%` }}
                />
            )
        })}
      </div>
    );
  };

  const getStatusText = () => {
      switch(status) {
          case SessionStatus.RECORDING: return '録音中...';
          case SessionStatus.PAUSED: return '一時停止中';
          case SessionStatus.COMPLETED: return '録音完了';
          case SessionStatus.ERROR: return 'エラー';
          default: return 'リアルタイム文字起こし';
      }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header / Status */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {status === SessionStatus.RECORDING && (
            <div className="animate-pulse">
               <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            </div>
          )}
          {status === SessionStatus.PAUSED && (
             <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
          )}
          <h2 className="font-semibold text-gray-800">
            {getStatusText()}
          </h2>
        </div>
        {renderVisualizer()}
      </div>

      {/* Transcript Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-32" ref={scrollRef}>
        {transcript.length === 0 && status === SessionStatus.RECORDING && (
           <div className="text-center text-gray-400 mt-20">
             <p>会話を聞き取っています...</p>
             <p className="text-sm mt-2">マイクに向かって話してください。</p>
           </div>
        )}
        
        {transcript.map((item, idx) => (
          <div key={`${item.id}-${idx}`} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed
                ${item.role === 'user' 
                  ? 'bg-brand-50 text-brand-900 rounded-tr-none' 
                  : 'bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200'}
              `}
            >
              <p>{item.text}</p>
              {item.isPartial && <span className="inline-block w-1.5 h-1.5 bg-current rounded-full ml-1 animate-bounce"/>}
            </div>
          </div>
        ))}

        {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm text-center font-bold">
                ⚠️ {error}
            </div>
        )}
      </div>

      {/* Floating Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent">
        <div className="flex gap-4 max-w-md mx-auto">
          {status === SessionStatus.RECORDING ? (
            <>
              <button 
                onClick={onPause}
                className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium py-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                一時停止
              </button>
              <button 
                onClick={onStop}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-4 rounded-xl shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                終了
              </button>
            </>
          ) : status === SessionStatus.PAUSED ? (
            <>
              <button 
                onClick={onResume}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-medium py-4 rounded-xl shadow-lg shadow-brand-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                再開
              </button>
              <button 
                onClick={onStop}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-4 rounded-xl shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                終了
              </button>
            </>
          ) : (
             <button 
              onClick={onGenerate}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-medium py-4 rounded-xl shadow-lg shadow-brand-200 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
              議事録を作成
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveView;