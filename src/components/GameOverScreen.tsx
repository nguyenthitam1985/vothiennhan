import React from 'react';
import { SubjectId } from '../types/game';
import { SUBJECT_INFOS } from '../data/defaultQuestions';
import { Skull, RotateCcw, ArrowLeft, Target, AlertTriangle } from 'lucide-react';

interface GameOverScreenProps {
  score: number;
  kills: number;
  subject: SubjectId;
  reason?: 'zombie_bite' | 'wrong_answers';
  onRestart: () => void;
  onSelectSubject: () => void;
  onMenu: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  score,
  kills,
  subject,
  reason = 'zombie_bite',
  onRestart,
  onSelectSubject,
  onMenu,
}) => {
  const subjInfo = SUBJECT_INFOS[subject];
  const isWrongAnswerLoss = reason === 'wrong_answers';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background red pulse */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.15)_0,transparent_75%)] pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900/90 border-2 border-rose-500/70 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-500/20 text-center space-y-6 relative z-10 backdrop-blur">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-rose-950/80 border-2 border-rose-500 flex items-center justify-center shadow-xl shadow-rose-600/30 mx-auto">
          {isWrongAnswerLoss ? (
            <AlertTriangle className="w-10 h-10 text-rose-500 animate-pulse" />
          ) : (
            <Skull className="w-10 h-10 text-rose-500 animate-pulse" />
          )}
        </div>

        {/* Title */}
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-widest text-rose-400 font-retro">
            {isWrongAnswerLoss
              ? '❌ TRẢ LỜI SAI 3 CÂU HỎI TRẮC NGHIỆM'
              : '🧟 BỊ ZOMBIE CẮN GỤC NGÃ'}
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-white">
            {isWrongAnswerLoss ? 'THẤT BẠI TRẮC NGHIỆM' : 'HẾT MÁU SINH TỒN'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {isWrongAnswerLoss ? (
              <>
                Bạn đã trả lời sai <strong>3 câu hỏi</strong> của môn{' '}
                <strong className="text-rose-400">{subjInfo.name}</strong>. Hãy ôn tập lại ngân hàng đề thi và thử lại nhé!
              </>
            ) : (
              <>
                Chiến binh đã hết máu trước bầy zombie hung hãn trên chiến trường{' '}
                <strong className="text-rose-400">{subjInfo.name}</strong>. Hãy di chuyển linh hoạt và giữ khoảng cách!
              </>
            )}
          </p>
        </div>

        {/* Score & Kills */}
        <div className="grid grid-cols-2 gap-3 bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
          <div>
            <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">
              Điểm Số Sinh Tồn
            </div>
            <div className="text-xl sm:text-2xl font-black font-retro text-amber-400 mt-1">
              {score}
            </div>
          </div>
          <div className="border-l border-slate-800">
            <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">
              Zombie Đã Diệt
            </div>
            <div className="text-xl sm:text-2xl font-black font-retro text-rose-400 mt-1">
              {kills}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onRestart}
            className="w-full sm:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-rose-600/30 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Tái sinh chiến đấu</span>
          </button>

          <button
            onClick={onSelectSubject}
            className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm rounded-xl border border-slate-700 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Target className="w-4 h-4 text-amber-400" />
            <span>Chọn môn khác</span>
          </button>

          <button
            onClick={onMenu}
            className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-sm rounded-xl border border-slate-800 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Menu chính</span>
          </button>
        </div>
      </div>
    </div>
  );
};
