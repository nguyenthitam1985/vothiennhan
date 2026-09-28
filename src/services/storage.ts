import { Question, SubjectId } from '../types/game';
import { DEFAULT_QUESTIONS } from '../data/defaultQuestions';

const STORAGE_KEY = 'contra_edu_questions_v1';
const HIGHSCORE_PREFIX = 'contra_high_score_';

export function getQuestions(): Question[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First time initialization
      saveQuestions(DEFAULT_QUESTIONS);
      return DEFAULT_QUESTIONS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Seamlessly merge any new questions from DEFAULT_QUESTIONS that aren't present yet
      const existingIds = new Set(parsed.map((q: Question) => q.id));
      let hasNew = false;
      const merged = [...parsed];
      for (const defQ of DEFAULT_QUESTIONS) {
        if (!existingIds.has(defQ.id)) {
          merged.push(defQ);
          hasNew = true;
        }
      }
      if (hasNew) {
        saveQuestions(merged);
        return merged;
      }
      return parsed;
    }
    // Fallback if empty array
    saveQuestions(DEFAULT_QUESTIONS);
    return DEFAULT_QUESTIONS;
  } catch (err) {
    console.error('Error loading questions from localStorage:', err);
    return DEFAULT_QUESTIONS;
  }
}

export function saveQuestions(questions: Question[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  } catch (err) {
    console.error('Error saving questions to localStorage:', err);
  }
}

export function getQuestionsBySubject(subject: SubjectId): Question[] {
  const all = getQuestions();
  return all.filter((q) => q.subject === subject);
}

export function addQuestion(qData: Omit<Question, 'id' | 'createdAt'>): Question {
  const current = getQuestions();
  const newQuestion: Question = {
    ...qData,
    id: 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    createdAt: Date.now(),
  };
  const updated = [newQuestion, ...current];
  saveQuestions(updated);
  return newQuestion;
}

export function updateQuestion(id: string, qData: Partial<Question>): Question | null {
  const current = getQuestions();
  const index = current.findIndex((q) => q.id === id);
  if (index === -1) return null;

  const updatedQuestion: Question = {
    ...current[index],
    ...qData,
  };
  current[index] = updatedQuestion;
  saveQuestions(current);
  return updatedQuestion;
}

export function deleteQuestion(id: string): boolean {
  const current = getQuestions();
  const filtered = current.filter((q) => q.id !== id);
  if (filtered.length === current.length) return false;
  saveQuestions(filtered);
  return true;
}

export function resetDefaultQuestions(): Question[] {
  saveQuestions(DEFAULT_QUESTIONS);
  return DEFAULT_QUESTIONS;
}

export function exportQuestionsJSON(): string {
  const questions = getQuestions();
  return JSON.stringify(questions, null, 2);
}

export function importQuestionsJSON(jsonString: string): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      return { success: false, count: 0, error: 'Dữ liệu JSON phải là một danh sách câu hỏi.' };
    }
    // Validate items
    const validQuestions: Question[] = [];
    for (const item of parsed) {
      if (
        item.question &&
        Array.isArray(item.options) &&
        item.options.length === 4 &&
        typeof item.correctIndex === 'number' &&
        item.correctIndex >= 0 &&
        item.correctIndex <= 3 &&
        ['history', 'literature', 'ktpl'].includes(item.subject)
      ) {
        validQuestions.push({
          id: item.id || 'imp_' + Math.random().toString(36).substring(2, 9),
          subject: item.subject as SubjectId,
          question: String(item.question),
          options: [
            String(item.options[0]),
            String(item.options[1]),
            String(item.options[2]),
            String(item.options[3]),
          ],
          correctIndex: item.correctIndex,
          hint: item.hint ? String(item.hint) : 'Không có gợi ý',
          createdAt: item.createdAt || Date.now(),
        });
      }
    }

    if (validQuestions.length === 0) {
      return { success: false, count: 0, error: 'Không tìm thấy câu hỏi hợp lệ trong tệp JSON đã chọn.' };
    }

    saveQuestions(validQuestions);
    return { success: true, count: validQuestions.length };
  } catch (err) {
    return { success: false, count: 0, error: 'Tệp JSON không đúng định dạng: ' + (err as Error).message };
  }
}

export function getHighScore(subject: SubjectId): number {
  try {
    const val = localStorage.getItem(HIGHSCORE_PREFIX + subject);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(subject: SubjectId, score: number): boolean {
  try {
    const current = getHighScore(subject);
    if (score > current) {
      localStorage.setItem(HIGHSCORE_PREFIX + subject, String(score));
      return true;
    }
  } catch {}
  return false;
}
