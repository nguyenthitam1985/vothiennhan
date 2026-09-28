import React, { useState, useEffect } from 'react';
import { Question, SubjectId } from '../types/game';
import { SUBJECT_INFOS } from '../data/defaultQuestions';
import { sounds } from '../services/soundEngine';
import confetti from 'canvas-confetti';
import {
  ShieldAlert,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Zap,
  Heart,
  Clock,
  RotateCcw,
  AlertTriangle,
  Play,
} from 'lucide-react';

interface QuizPortalModalProps {
  questionNumber: number;
  question: Question;
  subject: SubjectId;
  correctCount: number;
  wrongCount: number;
  onResult: (isCorrect: boolean) => void;
}

export const QuizPortalModal: React.FC<QuizPortalModalProps> = ({
  questionNumber,
  question,
  subject,
  correctCount,
  wrongCount,
  onResult,
}) => {
  // 20-second countdown timer for each question
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [isTimeOut, setIsTimeOut] = useState<boolean>(false);

  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [isWrong, setIsWrong] = useState<boolean>(false);
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);

  const subjInfo = SUBJECT_INFOS[subject];

  // 20-second countdown effect
  useEffect(() => {
    if (isSolved || isWrong || isTimeOut) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsTimeOut(true);
          sounds.quizWrong();
          setShake(true);
          setTimeout(() => setShake(false), 500);
          return 0;
        }

        // Ticking warning sound on last 5 seconds
        if (prev <= 6) {
          sounds.timerTick();
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSolved, isWrong, isTimeOut]);

  const handleSelect = (idx: number) => {
    if (isSolved || isWrong || isTimeOut) return;
    setSelectedOpt(idx);

    if (idx === question.correctIndex) {
      // CORRECT!
      setIsSolved(true);
      setIsWrong(false);
      setIsTimeOut(false);
      sounds.quizCorrect();

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#34d399'],
        });
      } catch {}

      // Short delay to show "+40 MÁU" then return true
      setTimeout(() => {
        onResult(true);
      }, 1200);
    } else {
      // WRONG!
      setIsWrong(true);
      sounds.quizWrong();
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleContinueAfterWrong = () => {
    onResult(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      {/* Sci-fi Hologram Portal Frame */}
      <div
        className={`w-full max-w-2xl bg-slate-900/95 border-2 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-5 relative transition-all ${
          isSolved
            ? 'border-emerald-500 shadow-emerald-500/30'
            : isTimeOut || isWrong
            ? 'border-rose-500 shadow-rose-500/30'
            : 'border-amber-500 shadow-amber-500/20'
        } ${shake ? 'animate-bounce' : ''}`}
      >
        {/* Top Header with 20s Countdown Timer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <Zap className="w-5 h-5 text-amber-400" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400 font-retro">
                  CÂU HỎI SỐ #{questionNumber} (MỖI 10 GIÂY)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  ĐÚNG: {correctCount}/6 (ĐẠT 6 THẮNG)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                  SAI: {wrongCount}/3 (CHẠM 3 THUA)
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold font-display text-white mt-0.5">
                Trả lời đúng để CỘNG +40 MÁU! Trả lời sai chạy bắn tiếp!
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* 20-Second Digital Timer Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-retro font-bold text-xs shadow-md transition-all ${
                isSolved
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400'
                  : timeLeft <= 5
                  ? 'bg-rose-950/90 border-rose-500 text-rose-400 animate-pulse glow-rose'
                  : timeLeft <= 10
                  ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                  : 'bg-slate-800/90 border-slate-700 text-cyan-300'
              }`}
            >
              <Clock className={`w-4 h-4 ${timeLeft <= 5 && !isSolved ? 'animate-spin' : ''}`} />
              <span className="text-sm">
                {isSolved ? 'HOÀN THÀNH' : `${timeLeft.toString().padStart(2, '0')}s`}
              </span>
            </div>

            {/* Subject Badge */}
            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${subjInfo.accentClass} flex items-center gap-1.5`}
            >
              <span>{subjInfo.icon}</span>
              <span className="hidden sm:inline">{subjInfo.name}</span>
            </span>
          </div>
        </div>

        {/* 20-Second Animated Progress Bar */}
        <div className="w-full space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400 font-medium">
            <span>Thời gian trả lời:</span>
            <span className={timeLeft <= 5 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
              {timeLeft} / 20 giây
            </span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${
                isSolved
                  ? 'bg-emerald-500'
                  : timeLeft > 10
                  ? 'bg-emerald-500'
                  : timeLeft > 5
                  ? 'bg-amber-500'
                  : 'bg-rose-500 animate-pulse'
              }`}
              style={{ width: `${(timeLeft / 20) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Prompt */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 sm:p-5">
          <p className="text-base sm:text-lg font-bold text-slate-100 leading-relaxed font-display">
            {question.question}
          </p>
        </div>

        {/* 4 Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isSelected = selectedOpt === idx;
            const isThisCorrect = (isSolved || isWrong || isTimeOut) && idx === question.correctIndex;
            const isThisWrong = isWrong && isSelected && idx !== question.correctIndex;

            return (
              <button
                key={idx}
                disabled={isSolved || isWrong || isTimeOut}
                onClick={() => handleSelect(idx)}
                className={`p-3.5 rounded-xl border-2 text-left font-medium text-sm transition-all flex items-center gap-3 cursor-pointer ${
                  isThisCorrect
                    ? 'bg-emerald-950/80 border-emerald-400 text-emerald-100 ring-2 ring-emerald-400/50 scale-[1.02]'
                    : isThisWrong
                    ? 'bg-rose-950/80 border-rose-500 text-rose-100'
                    : isSelected
                    ? 'bg-slate-800 border-amber-400 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:border-amber-400/70 hover:bg-slate-800/80'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    isThisCorrect
                      ? 'bg-emerald-500 text-slate-950'
                      : isThisWrong
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 text-amber-400 border border-slate-700'
                  }`}
                >
                  {letter}
                </span>
                <span className="flex-1 text-xs sm:text-sm">{opt}</span>
              </button>
            );
          })}
        </div>

        {/* Wrong or Time Out Banner with Continue Button ("chạy bắn tiếp như thường") */}
        {(isWrong || isTimeOut) && !isSolved && (
          <div className="bg-rose-950/90 border border-rose-500/80 rounded-xl p-4 space-y-2.5 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-rose-200 text-xs sm:text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>
                  <strong>{isTimeOut ? 'HẾT 20 GIÂY!' : 'TRẢ LỜI CHƯA ĐÚNG!'}</strong> Bạn bị tính 1 câu sai ({wrongCount + 1}/3). Đáp án đúng là <strong>{String.fromCharCode(65 + question.correctIndex)}</strong>.
                </span>
              </div>
              <button
                onClick={handleContinueAfterWrong}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 text-xs font-black rounded-xl transition shrink-0 flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <span>CHẠY BẮN TIẾP</span>
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
            </div>
            {question.hint && (
              <div className="text-xs text-amber-300/90 pl-7 flex items-start gap-1.5 border-t border-rose-900/60 pt-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Gợi ý ôn tập:</strong> {question.hint}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Solved Banner */}
        {isSolved && (
          <div className="bg-emerald-950/80 border border-emerald-500/80 rounded-xl p-4 flex items-center gap-3 animate-in fade-in zoom-in-95 text-emerald-200">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-emerald-300">
                  🎉 CHÍNH XÁC! ĐÃ CỘNG +40 MÁU & HỒI MANA! ({correctCount + 1}/6 ĐÚNG)
                </span>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </p>
              <p className="text-xs text-emerald-300/80">
                Máu đã hồi phục! {correctCount + 1 >= 6 ? 'ĐẠT 6 CÂU ĐÚNG - GIÀNH CHIẾN THẮNG!' : 'Tiếp tục sinh tồn và chiến đấu!'}
              </p>
            </div>
          </div>
        )}

        {/* Help footer note */}
        <div className="text-center text-[11px] text-slate-500">
          {!isSolved && !isWrong && !isTimeOut && (
            <span>
              ⏱️ Bạn có <strong>20 giây</strong> để chọn đáp án đúng • Trả lời đúng được <strong>CỘNG +40 MÁU</strong> • Trả lời đúng <strong>6 câu</strong> là <strong>CHIẾN THẮNG</strong> • Sai <strong>3 câu</strong> là <strong>THUA</strong>!
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
