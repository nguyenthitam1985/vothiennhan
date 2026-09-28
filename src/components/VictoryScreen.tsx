import React, { useEffect } from 'react';
import { SubjectId } from '../types/game';
import { SUBJECT_INFOS } from '../data/defaultQuestions';
import { saveHighScore, getHighScore } from '../services/storage';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, ArrowLeft, Sparkles, CheckCircle2, Zap } from 'lucide-react';

interface VictoryScreenProps {
  score: number;
  kills: number;
  subject: SubjectId;
  onRestart: () => void;
  onSelectSubject: () => void;
  onMenu: () => void;
}

export const VictoryScreen: React.FC<VictoryScreenProps> = ({
  score,
  kills,
  subject,
  onRestart,
  onSelectSubject,
  onMenu,
}) => {
  const isNewRecord = saveHighScore(subject, score);
  const currentBest = getHighScore(subject);
  const subjInfo = SUBJECT_INFOS[subject];

  useEffect(() => {
    // Grand victory fireworks confetti
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      colors: ['#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#facc15'],
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.12)_0,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-xl bg-slate-900/90 border-2 border-emerald-500/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-500/20 text-center space-y-6 relative z-10 backdrop-blur">
        {/* Victory Trophy Badge */}
        <div className="relative inline-block">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-emerald-600 to-amber-400 flex items-center justify-center shadow-xl shadow-emerald-500/30 mx-auto animate-bounce">
            <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-slate-950" />
          </div>
          {isNewRecord && (
            <div className="absolute -top-2 -right-4 bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-lg border border-amber-300 flex items-center gap-1 animate-pulse">
              <Sparkles className="w-3 h-3" />
              <span>KỶ LỤC MỚI!</span>
            </div>
          )}
        </div>

        {/* Title & Subject */}
        <div className="space-y-2">
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${subjInfo.accentClass} inline-flex items-center gap-1.5`}>
            <span>{subjInfo.icon}</span>
            <span>Hoàn thành xuất sắc: {subjInfo.name}</span>
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold font-display text-white tracking-wide">
            CHIẾN THẮNG SINH TỒN!
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Chúc mừng bạn đã xuất sắc trả lời đúng <strong>6/6 câu hỏi</strong> môn {subjInfo.name} và dũng cảm quét sạch đại dịch Zombie!
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
          <div>
            <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">Tổng Điểm</div>
            <div className="text-lg sm:text-2xl font-black font-retro text-amber-400 mt-1">{score}</div>
          </div>
          <div className="border-x border-slate-800">
            <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">Zombie Đã Diệt</div>
            <div className="text-lg sm:text-2xl font-black font-retro text-emerald-400 mt-1">{kills}</div>
          </div>
          <div>
            <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">Kỷ Lục Môn</div>
            <div className="text-lg sm:text-2xl font-black font-retro text-cyan-400 mt-1">{currentBest}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onRestart}
            className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Chơi lại màn này</span>
          </button>

          <button
            onClick={onSelectSubject}
            className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/25 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            <span>Đổi chủ đề khác</span>
          </button>

          <button
            onClick={onMenu}
            className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl border border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Menu chính</span>
          </button>
        </div>
      </div>
    </div>
  );
};
