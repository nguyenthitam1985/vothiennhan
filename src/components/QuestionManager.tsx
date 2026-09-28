import React, { useState, useId } from 'react';
import { Question, SubjectId } from '../types/game';
import { SUBJECT_INFOS } from '../data/defaultQuestions';
import {
  getQuestions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  resetDefaultQuestions,
  exportQuestionsJSON,
  importQuestionsJSON,
} from '../services/storage';
import {
  Plus,
  Trash2,
  Edit3,
  Search,
  RotateCcw,
  Download,
  Upload,
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';

interface QuestionManagerProps {
  onBack: () => void;
  onQuestionsUpdated?: () => void;
}

export const QuestionManager: React.FC<QuestionManagerProps> = ({ onBack, onQuestionsUpdated }) => {
  const [questions, setQuestions] = useState<Question[]>(() => getQuestions());
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<SubjectId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states (Create or Edit)
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formSubject, setFormSubject] = useState<SubjectId>('history');
  const [formQuestion, setFormQuestion] = useState('');
  const [formOptions, setFormOptions] = useState<[string, string, string, string]>(['', '', '', '']);
  const [formCorrectIndex, setFormCorrectIndex] = useState<number>(0);
  const [formHint, setFormHint] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState<boolean>(false);

  // Confirmation dialog state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const fileInputId = useId();

  const showNotify = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const refreshList = () => {
    const list = getQuestions();
    setQuestions(list);
    if (onQuestionsUpdated) onQuestionsUpdated();
  };

  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormSubject(selectedSubjectFilter === 'all' ? 'history' : selectedSubjectFilter);
    setFormQuestion('');
    setFormOptions(['', '', '', '']);
    setFormCorrectIndex(0);
    setFormHint('');
    setFormError(null);
    setShowFormModal(true);
  };

  const handleOpenEdit = (q: Question) => {
    setIsEditing(true);
    setEditingId(q.id);
    setFormSubject(q.subject);
    setFormQuestion(q.question);
    setFormOptions([...q.options] as [string, string, string, string]);
    setFormCorrectIndex(q.correctIndex);
    setFormHint(q.hint || '');
    setFormError(null);
    setShowFormModal(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formQuestion.trim()) {
      setFormError('Vui lòng nhập nội dung câu hỏi.');
      return;
    }
    for (let i = 0; i < 4; i++) {
      if (!formOptions[i].trim()) {
        setFormError(`Vui lòng nhập phương án ${String.fromCharCode(65 + i)}.`);
        return;
      }
    }
    if (!formHint.trim()) {
      setFormError('Vui lòng nhập gợi ý cho câu hỏi khi học sinh trả lời sai.');
      return;
    }

    if (isEditing && editingId) {
      updateQuestion(editingId, {
        subject: formSubject,
        question: formQuestion.trim(),
        options: [
          formOptions[0].trim(),
          formOptions[1].trim(),
          formOptions[2].trim(),
          formOptions[3].trim(),
        ],
        correctIndex: formCorrectIndex,
        hint: formHint.trim(),
      });
      showNotify('Đã cập nhật câu hỏi thành công!', 'success');
    } else {
      addQuestion({
        subject: formSubject,
        question: formQuestion.trim(),
        options: [
          formOptions[0].trim(),
          formOptions[1].trim(),
          formOptions[2].trim(),
          formOptions[3].trim(),
        ],
        correctIndex: formCorrectIndex,
        hint: formHint.trim(),
      });
      showNotify('Đã thêm câu hỏi mới thành công!', 'success');
    }

    setShowFormModal(false);
    refreshList();
  };

  const handleDelete = (id: string) => {
    deleteQuestion(id);
    setDeleteConfirmId(null);
    showNotify('Đã xóa câu hỏi khỏi ngân hàng đề.', 'info');
    refreshList();
  };

  const handleResetDefaults = () => {
    resetDefaultQuestions();
    setResetConfirmOpen(false);
    showNotify('Đã khôi phục 30 câu hỏi mẫu tiêu chuẩn!', 'success');
    refreshList();
  };

  const handleExportJSON = () => {
    const data = exportQuestionsJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ngan-hang-cau-hoi-contra-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotify('Đã xuất tệp câu hỏi thành công!', 'success');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importQuestionsJSON(content);
      if (res.success) {
        showNotify(`Đã nhập thành công ${res.count} câu hỏi!`, 'success');
        refreshList();
      } else {
        showNotify(res.error || 'Nhập tệp thất bại!', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filter & search
  const filteredQuestions = questions.filter((q) => {
    const matchSubject = selectedSubjectFilter === 'all' || q.subject === selectedSubjectFilter;
    const matchSearch =
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.options.some((opt) => opt.toLowerCase().includes(searchQuery.toLowerCase())) ||
      q.hint.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSubject && matchSearch;
  });

  const countBySubject = {
    all: questions.length,
    history: questions.filter((q) => q.subject === 'history').length,
    literature: questions.filter((q) => q.subject === 'literature').length,
    ktpl: questions.filter((q) => q.subject === 'ktpl').length,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 py-3 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Menu chính</span>
            </button>
            <div className="h-5 w-[1px] bg-slate-700 hidden sm:block" />
            <h1 className="text-lg sm:text-xl font-bold font-display tracking-wide text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-400" />
              <span>Quản lý Ngân hàng Câu hỏi Trắc nghiệm</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportJSON}
              title="Xuất danh sách câu hỏi ra file JSON"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xuất JSON</span>
            </button>

            <label
              htmlFor={fileInputId}
              title="Nhập câu hỏi từ file JSON"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nhập JSON</span>
            </label>
            <input
              id={fileInputId}
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />

            <button
              onClick={() => setResetConfirmOpen(true)}
              title="Khôi phục câu hỏi ban đầu"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mặc định</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-lg shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm câu hỏi mới</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto w-full p-4 sm:p-6 flex-1 flex flex-col gap-6">
        {/* Toast Notification */}
        {notification && (
          <div
            className={`fixed top-16 right-4 sm:right-8 z-50 px-4 py-2.5 rounded-lg border shadow-xl flex items-center gap-2 text-sm font-medium animate-bounce ${
              notification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                : notification.type === 'error'
                ? 'bg-rose-950/90 border-rose-500 text-rose-200'
                : 'bg-cyan-950/90 border-cyan-500 text-cyan-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification.message}</span>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Subject Filter Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedSubjectFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                selectedSubjectFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>Tất cả</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20">{countBySubject.all}</span>
            </button>

            {(['history', 'literature', 'ktpl'] as SubjectId[]).map((subj) => {
              const info = SUBJECT_INFOS[subj];
              const isSelected = selectedSubjectFilter === subj;
              return (
                <button
                  key={subj}
                  onClick={() => setSelectedSubjectFilter(subj)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{info.icon}</span>
                  <span>{info.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20">
                    {countBySubject[subj]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm nội dung câu hỏi, gợi ý..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
            />
          </div>
        </div>

        {/* Questions List */}
        <div className="flex-1 space-y-3">
          {filteredQuestions.length === 0 ? (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-12 text-center flex flex-col items-center justify-center">
              <BookOpen className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-slate-400 font-medium text-sm">Không tìm thấy câu hỏi nào phù hợp.</p>
              <button
                onClick={handleOpenCreate}
                className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer"
              >
                + Thêm câu hỏi đầu tiên
              </button>
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const subjInfo = SUBJECT_INFOS[q.subject];
              return (
                <div
                  key={q.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-4 sm:p-5 transition flex flex-col gap-3 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-slate-500">#{idx + 1}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${subjInfo.accentClass} flex items-center gap-1`}>
                        <span>{subjInfo.icon}</span>
                        <span>{subjInfo.name}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(q)}
                        title="Chỉnh sửa câu hỏi"
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded-lg transition cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(q.id)}
                        title="Xóa câu hỏi"
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Question Text */}
                  <h3 className="text-sm sm:text-base font-semibold text-slate-100 leading-snug">
                    {q.question}
                  </h3>

                  {/* 4 Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = optIdx === q.correctIndex;
                      const letter = String.fromCharCode(65 + optIdx);
                      return (
                        <div
                          key={optIdx}
                          className={`text-xs px-3 py-2 rounded-lg border flex items-start gap-2 ${
                            isCorrect
                              ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200 font-medium'
                              : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              isCorrect
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="flex-1 break-words">{opt}</span>
                          {isCorrect && (
                            <span className="text-[10px] text-emerald-400 font-bold shrink-0">
                              (Đáp án đúng)
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Hint */}
                  {q.hint && (
                    <div className="text-[11px] text-amber-300/80 bg-amber-950/20 border border-amber-900/30 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        <strong className="text-amber-400">Gợi ý khi trả lời sai:</strong> {q.hint}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold font-display text-white flex items-center gap-2">
                {isEditing ? <Edit3 className="w-5 h-5 text-amber-400" /> : <Plus className="w-5 h-5 text-amber-400" />}
                <span>{isEditing ? 'Sửa Câu Hỏi' : 'Thêm Câu Hỏi Mới'}</span>
              </h2>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="bg-rose-950/80 border border-rose-500 text-rose-200 text-xs p-3 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveForm} className="space-y-4">
              {/* Subject Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Chủ đề môn học:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['history', 'literature', 'ktpl'] as SubjectId[]).map((sId) => {
                    const s = SUBJECT_INFOS[sId];
                    const active = formSubject === sId;
                    return (
                      <button
                        type="button"
                        key={sId}
                        onClick={() => setFormSubject(sId)}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          active
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        <span>{s.icon}</span>
                        <span>{s.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nội dung câu hỏi:
                </label>
                <textarea
                  rows={3}
                  value={formQuestion}
                  onChange={(e) => setFormQuestion(e.target.value)}
                  placeholder="Nhập câu hỏi trắc nghiệm tại đây..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 outline-none"
                />
              </div>

              {/* 4 Options */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  4 Phương án A - B - C - D (Chọn tròn vào đáp án đúng):
                </label>
                {[0, 1, 2, 3].map((optIdx) => {
                  const letter = String.fromCharCode(65 + optIdx);
                  const isChecked = formCorrectIndex === optIdx;
                  return (
                    <div
                      key={optIdx}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition ${
                        isChecked ? 'border-emerald-500 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setFormCorrectIndex(optIdx)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition cursor-pointer ${
                          isChecked
                            ? 'bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-400'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                        title="Nhấn để đặt làm đáp án đúng"
                      >
                        {letter}
                      </button>

                      <input
                        type="text"
                        placeholder={`Phương án ${letter}...`}
                        value={formOptions[optIdx]}
                        onChange={(e) => {
                          const nextOpts = [...formOptions] as [string, string, string, string];
                          nextOpts[optIdx] = e.target.value;
                          setFormOptions(nextOpts);
                        }}
                        className="flex-1 bg-transparent border-none outline-none text-xs text-slate-100 placeholder-slate-500"
                      />

                      {isChecked && (
                        <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 shrink-0">
                          Đáp án đúng
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Hint */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Gợi ý hướng dẫn (Hiện lên khi học sinh chọn sai):</span>
                </label>
                <input
                  type="text"
                  value={formHint}
                  onChange={(e) => setFormHint(e.target.value)}
                  placeholder="Gợi ý chi tiết giúp học sinh suy luận ra câu trả lời..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-amber-500/20 transition cursor-pointer"
                >
                  {isEditing ? 'Lưu Thay Đổi' : 'Thêm Vào Ngân Hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Xác nhận xóa câu hỏi?</h3>
            </div>
            <p className="text-xs text-slate-300">
              Bạn có chắc chắn muốn xóa câu hỏi này khỏi danh sách ôn tập không? Hành động này sẽ được lưu ngay lập tức vào trình duyệt.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-rose-600/30 transition cursor-pointer"
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET CONFIRM MODAL */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <RotateCcw className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Khôi phục đề mặc định?</h3>
            </div>
            <p className="text-xs text-slate-300">
              Hành động này sẽ khôi phục lại 30 câu hỏi mẫu tiêu chuẩn cho 3 môn Lịch sử, Ngữ văn, và KTPL. Các câu hỏi bạn tự thêm có thể bị thay thế.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setResetConfirmOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleResetDefaults}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow transition cursor-pointer"
              >
                Xác nhận khôi phục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
