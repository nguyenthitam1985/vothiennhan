import React, { useState } from 'react';
import { SubjectId } from '../types/game';
import { SUBJECT_INFOS } from '../data/defaultQuestions';
import { getHighScore, getQuestionsBySubject } from '../services/storage';
import { Play, ArrowLeft, Trophy, Target, Sparkles, ShieldAlert } from 'lucide-react';

interface SubjectSelectModalProps {
  onSelectSubject: (subject: SubjectId) => void;
  onBack: () => void;
}

export const SubjectSelectModal: React.FC<SubjectSelectModalProps> = ({ onSelectSubject, onBack }) => {
  const [selected, setSelected] = useState<SubjectId>('history');

  const subjects: SubjectId[] = ['history', 'literature', 'ktpl'];

  return (
    <div className="min-h-screen bg-slate-950/95 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background visual effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.06)_0,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-3xl space-y-6 relative z-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Target className="w-3.5 h-3.5" />
            <span>Chiến Dịch Sinh Tồn Zombie Tri Thức</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold font-display text-white tracking-wide">
            CHỌN CHỦ ĐỀ VÀO CHIẾN TRƯỜNG
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
            Các rào chắn kiểm dịch và cổng cách ly trong vùng zombie sẽ sử dụng 100% câu hỏi thuộc bộ môn bạn lựa chọn!
          </p>
        </div>

        {/* 3 Subject Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {subjects.map((sId) => {
            const info = SUBJECT_INFOS[sId];
            const isChosen = selected === sId;
            const qCount = getQuestionsBySubject(sId).length;
            const highScore = getHighScore(sId);

            return (
              <div
                key={sId}
                onClick={() => setSelected(sId)}
                className={`relative rounded-2xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between select-none ${
                  isChosen
                    ? 'bg-slate-900 border-amber-400 shadow-xl shadow-amber-500/20 scale-[1.02]'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                {isChosen && (
                  <div className="absolute -top-3 right-4 bg-amber-500 text-slate-950 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>ĐANG CHỌN</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-4xl p-2 rounded-xl bg-slate-800/80 inline-block shadow-inner">
                      {info.icon}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${info.accentClass}`}>
                      {info.shortName}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white font-display flex items-center gap-1.5">
                      {info.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                      {info.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Ngân hàng đề:</span>
                    <span className="font-bold text-slate-200">{qCount} câu hỏi</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1 text-amber-400/90">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Kỷ lục:</span>
                    </span>
                    <span className="font-mono font-bold text-amber-400">{highScore} điểm</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <button
            onClick={onBack}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Menu</span>
          </button>

          <button
            onClick={() => onSelectSubject(selected)}
            className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-base rounded-xl shadow-xl shadow-amber-500/25 transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>XUẤT TRẬN (CHIẾN DỊCH {SUBJECT_INFOS[selected].name.toUpperCase()})</span>
          </button>
        </div>

        {/* Warning if 0 questions in subject */}
        {getQuestionsBySubject(selected).length === 0 && (
          <div className="bg-rose-950/80 border border-rose-500/70 p-3 rounded-xl flex items-center gap-2 text-rose-200 text-xs">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Chủ đề này chưa có câu hỏi nào trong ngân hàng đề! Hãy vào phần "Quản lý câu hỏi" để thêm câu hỏi hoặc khôi phục mặc định trước khi chơi.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
