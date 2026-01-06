
import React, { useState, useEffect } from 'react';
import { useLiveSession } from './hooks/useLiveSession';
import LiveView from './components/LiveView';
import ReportView from './components/ReportView';
import { SessionStatus, MeetingMinutes } from './types';

// 社内共有用の簡易パスコード（必要に応じて変更してください）
const APP_PASSCODE = "maestro2025";

const App: React.FC = () => {
  const { status, transcript, volume, connect, disconnect, pause, resume, generateMinutes, error } = useLiveSession();
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 認証状態の管理
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [authError, setAuthError] = useState(false);

  // 一度認証したらセッション中は保持
  useEffect(() => {
    const saved = sessionStorage.getItem('isAuthorized');
    if (saved === 'true') setIsAuthorized(true);
  }, []);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput === APP_PASSCODE) {
      setIsAuthorized(true);
      setAuthError(false);
      sessionStorage.setItem('isAuthorized', 'true');
    } else {
      setAuthError(true);
      setPasscodeInput("");
    }
  };

  const handleGenerate = async () => {
    setIsProcessing(true);
    const result = await generateMinutes();
    setMinutes(result);
    setIsProcessing(false);
  };

  const handleReset = () => {
      disconnect();
      setMinutes(null);
  };

  // 1. 認証画面 (Passcode Gate)
  if (!isAuthorized) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center h-screen bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-gray-100 text-center">
          <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">認証が必要です</h1>
          <p className="text-gray-500 text-sm mb-6">社内共有用のパスコードを入力してください</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <input 
              type="password"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              placeholder="パスコード"
              className={`w-full px-4 py-3 rounded-xl border ${authError ? 'border-red-500 bg-red-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-brand-500 text-center text-lg`}
              autoFocus
            />
            {authError && <p className="text-red-500 text-xs font-medium">パスコードが正しくありません</p>}
            <button 
              type="submit"
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-xl shadow-lg transition-transform active:scale-95"
            >
              ログイン
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. 議事録表示画面
  if (minutes) {
    return <ReportView minutes={minutes} onReset={handleReset} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* 3. ホーム画面 (Idle) */}
      {status === SessionStatus.IDLE && (
         <div className="flex-1 flex flex-col justify-center items-center p-6 text-center">
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-gray-100">
                <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                   <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">MinuteMaestro AI</h1>
                <p className="text-gray-500 mb-8 leading-relaxed">
                  社内会議をリアルタイムで記録・分析します。<br/>
                  開始ボタンを押すと録音が始まります。
                </p>
                <button 
                  onClick={connect}
                  className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-4 rounded-xl shadow-lg shadow-brand-200 transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                  会議を始める
                </button>
                <button 
                  onClick={() => {
                    sessionStorage.removeItem('isAuthorized');
                    setIsAuthorized(false);
                  }}
                  className="mt-6 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ログアウト
                </button>
            </div>
         </div>
      )}

      {/* 4. 録音・文字起こし画面 */}
      {(status === SessionStatus.CONNECTING || status === SessionStatus.RECORDING || status === SessionStatus.PAUSED || status === SessionStatus.COMPLETED || status === SessionStatus.ERROR) && !isProcessing && (
        <LiveView 
          status={status}
          transcript={transcript}
          volume={volume}
          onStop={disconnect}
          onPause={pause}
          onResume={resume}
          onGenerate={handleGenerate}
          error={error}
        />
      )}
      
      {/* 5. 処理中画面 */}
      {isProcessing && (
         <div className="flex-1 flex flex-col justify-center items-center bg-white p-6">
            <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-6"></div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">議事録を作成中...</h2>
            <p className="text-gray-500">AIが会話を分析し、重要なポイントを抽出しています。</p>
         </div>
      )}
    </div>
  );
};

export default App;
