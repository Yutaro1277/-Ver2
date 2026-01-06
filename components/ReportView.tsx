import React from 'react';
import { MeetingMinutes } from '../types';

interface ReportViewProps {
  minutes: MeetingMinutes;
  onReset: () => void;
}

const ReportView: React.FC<ReportViewProps> = ({ minutes, onReset }) => {
  const copyToClipboard = () => {
    const text = `
タイトル: ${minutes.title}
日付: ${minutes.date}

サマリー:
${minutes.summary}

トピック:
${minutes.topics.map(t => `- ${t.title}: ${t.details}`).join('\n')}

決定事項:
${minutes.decisions.map(d => `- ${d}`).join('\n')}

アクションアイテム:
${minutes.actionItems.map(a => `- [${a.assignee}] ${a.task} (期限: ${a.dueDate})`).join('\n')}
    `;
    navigator.clipboard.writeText(text);
    alert("クリップボードにコピーしました！");
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <h1 className="text-xl font-bold text-gray-800 truncate max-w-[70%]">{minutes.title}</h1>
        <div className="flex gap-2">
            <button 
                onClick={onReset}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="閉じる"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32">
        <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Meta */}
            <div className="flex items-center gap-4 text-sm text-gray-500 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    {minutes.date}
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    {minutes.attendees.length > 0 ? minutes.attendees.join(", ") : "参加者不明"}
                </div>
            </div>

            {/* Summary */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-1 h-6 bg-brand-500 rounded-full"></span>
                    サマリー
                </h3>
                <p className="text-gray-600 leading-relaxed">{minutes.summary}</p>
            </section>

            {/* Action Items */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                 <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
                    アクションアイテム
                </h3>
                <div className="grid gap-3">
                    {minutes.actionItems.length === 0 ? <p className="text-gray-400 italic">アクションアイテムはありません。</p> : minutes.actionItems.map((item, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                            <input type="checkbox" className="mt-1 w-4 h-4 text-brand-600 rounded focus:ring-brand-500" />
                            <div className="flex-1">
                                <p className="text-gray-800 font-medium">{item.task}</p>
                                <div className="flex gap-3 mt-1 text-xs text-blue-600 font-medium">
                                    <span className="bg-white px-2 py-0.5 rounded border border-blue-100 uppercase tracking-wide">{item.assignee}</span>
                                    {item.dueDate && <span>期限: {item.dueDate}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Decisions */}
             <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-1 h-6 bg-green-500 rounded-full"></span>
                    決定事項
                </h3>
                <ul className="space-y-2">
                     {minutes.decisions.length === 0 ? <p className="text-gray-400 italic">決定事項はありません。</p> : minutes.decisions.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-700">
                            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            {d}
                        </li>
                     ))}
                </ul>
            </section>

            {/* Topics */}
            <section className="space-y-4">
                 <h3 className="text-lg font-bold text-gray-800 px-2">ディスカッション内容</h3>
                 {minutes.topics.map((topic, i) => (
                     <div key={i} className="bg-white p-5 rounded-xl border border-gray-200">
                         <h4 className="font-semibold text-gray-900 mb-2">{topic.title}</h4>
                         <p className="text-gray-600 text-sm leading-relaxed">{topic.details}</p>
                     </div>
                 ))}
            </section>
        </div>
      </div>

       {/* Sticky Bottom Action */}
       <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent">
        <div className="max-w-3xl mx-auto">
            <button 
                onClick={copyToClipboard}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-4 rounded-xl shadow-lg shadow-brand-200 transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                議事録をコピーする
            </button>
        </div>
      </div>
    </div>
  );
};

export default ReportView;