import React from 'react';
import { SubjectId } from '../types/game';
import { SUBJECT_INFOS } from '../data/defaultQuestions';
import { getHighScore, getQuestionsBySubject } from '../services/storage';
import { sounds } from '../services/soundEngine';
import {
  Play,
  Settings,
  BookOpen,
  Trophy,
  Volume2,
  VolumeX,
  Crosshair,
  Shield,
  Moon,
  Zap,
  Skull,
  Biohazard,
  Flashlight,
} from 'lucide-react';

interface MainMenuProps {
  onStartCampaign: () => void;
  onOpenManageQuestions: () => void;
  onSelectSpecificSubject: (subject: SubjectId) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartCampaign,
  onOpenManageQuestions,
  onSelectSpecificSubject,
}) => {
  const [soundOn, setSoundOn] = React.useState(() => sounds.enabled);

  const toggleSound = () => {
    const next = sounds.toggleMute();
    setSoundOn(next);
  };

  const subjects: SubjectId[] = ['history', 'literature', 'ktpl'];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-x-hidden select-none">
      {/* Background Graphic Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.15)_0,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 crt-scanlines pointer-events-none opacity-25" />

      {/* Top Bar */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-rose-400">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <Biohazard className="w-3.5 h-3.5" />
          <span>CHIẾN DỊCH SINH TỒN ZOMBIE APOCALYPSE</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 transition cursor-pointer"
            title={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            onClick={onOpenManageQuestions}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-amber-400 transition cursor-pointer shadow-sm hover:border-amber-400/50"
          >
            <Settings className="w-4 h-4" />
            <span>Quản Lý Câu Hỏi / Cài Đặt Đề Thi</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto w-full flex flex-col items-center text-center my-6 space-y-8 z-10">
        {/* Retro Zombie Game Title */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-950/70 border border-red-500/50 text-red-400 text-xs font-bold tracking-widest uppercase">
            <Skull className="w-3.5 h-3.5 text-rose-400" />
            <span>BẮN SÚNG ZOMBIE 360° × THỬ THÁCH TRẮC NGHIỆM</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-red-200 to-rose-600 drop-shadow-2xl">
            BẮN SÚNG ZOMBIE
          </h1>

          <p className="text-xs sm:text-base text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
            Hóa thân thành chiến binh SWAT sinh tồn giữa đại dịch zombie rùng rợn! Xả đạn tiêu diệt bầy xác sống, giải mã các cổng kiểm dịch cách ly môn{' '}
            <strong className="text-red-400">Lịch Sử</strong>,{' '}
            <strong className="text-blue-400">Ngữ Văn</strong> và{' '}
            <strong className="text-emerald-400">Kinh Tế & Pháp Luật</strong> để tìm ra huyết thanh giải cứu thế giới!
          </p>
        </div>

        {/* Big Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-md">
          <button
            onClick={onStartCampaign}
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-rose-600 via-red-500 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black text-base sm:text-lg rounded-2xl shadow-xl shadow-rose-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-3 cursor-pointer"
          >
            <Play className="w-6 h-6 fill-current" />
            <span>CHIẾN ĐẤU DIỆT ZOMBIE</span>
          </button>

          <button
            onClick={onOpenManageQuestions}
            className="w-full sm:w-auto px-6 py-4 bg-slate-900 hover:bg-slate-800 border-2 border-slate-700 hover:border-amber-400/60 text-slate-200 hover:text-white font-bold text-sm sm:text-base rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <BookOpen className="w-5 h-5 text-amber-400" />
            <span>Ngân Hàng Đề Thi</span>
          </button>
        </div>

        {/* 3 Subjects Selection Cards */}
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-bold uppercase tracking-wider text-slate-300">
              Chọn Môn Học Để Vào Chiến Trường
            </span>
            <span>Chỉ 3 môn thi: Lịch Sử, Ngữ Văn, KTPL</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subjects.map((sId) => {
              const info = SUBJECT_INFOS[sId];
              const qCount = getQuestionsBySubject(sId).length;
              const highScore = getHighScore(sId);

              return (
                <div
                  key={sId}
                  onClick={() => onSelectSpecificSubject(sId)}
                  className="bg-slate-900/80 border border-slate-800 hover:border-rose-500/80 rounded-2xl p-4 text-left transition-all hover:scale-[1.02] cursor-pointer group shadow-lg flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl p-2 rounded-xl bg-slate-800/80 inline-block">
                        {info.icon}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${info.accentClass}`}>
                        {qCount} Câu hỏi
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white group-hover:text-rose-400 transition font-display">
                      {info.name}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {info.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 text-amber-400">
                      <Trophy className="w-3.5 h-3.5" />
                      <span>Kỷ lục: {highScore}</span>
                    </span>
                    <span className="font-bold text-slate-200 group-hover:text-rose-400 flex items-center gap-1">
                      <span>Vào trận</span>
                      <span>→</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full pt-2 text-left">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs">
              <Crosshair className="w-4 h-4" />
              <span>Kho Vũ Khí Diệt Zombie</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Nhặt hòm tiếp tế để trang bị súng máy AK-47 [M], shotgun chùm [S], súng laser plasma [L] hoặc tên lửa AOE [R].
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs">
              <Shield className="w-4 h-4" />
              <span>Khiên Điện Từ EMP (Phím K)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Tiêu hao 35 Mana tạo vòm xung kích giật điện và hất văng mọi zombie muốn tiếp cận trong 6 giây.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
              <Biohazard className="w-4 h-4" />
              <span>Cổng Kiểm Dịch Cấp 4</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Chạm rào chắn để đóng băng thời gian! Trả lời đúng trắc nghiệm để kích hoạt sóng xung điện khử trùng sạch zombie.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs">
              <Moon className="w-4 h-4" />
              <span>Đêm Tối & Đèn Pin Soi Rọi</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Chu kỳ Ngày sang Đêm kinh dị: Ban đêm tối đen, người chơi bật đèn pin soi đường và mắt zombie phát sáng đỏ rực!
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full text-center text-[11px] text-slate-500 py-3 border-t border-slate-900">
        Bắn Súng Zombie • Đột Kích Tri Thức Lịch Sử, Ngữ Văn & Kinh Tế Pháp Luật • Phím tắt: W/A/S/D di chuyển, Chuột/Phím J bắn, Phím K dùng Khiên EMP
      </footer>
    </div>
  );
};
