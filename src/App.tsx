import React, { useState } from 'react';
import { GameScreen, SubjectId, Question } from './types/game';
import { MainMenu } from './components/MainMenu';
import { SubjectSelectModal } from './components/SubjectSelectModal';
import { QuestionManager } from './components/QuestionManager';
import { GameCanvas } from './components/GameCanvas';
import { VictoryScreen } from './components/VictoryScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { getQuestionsBySubject } from './services/storage';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<GameScreen>('MENU');
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>('history');
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [finalScore, setFinalScore] = useState<number>(0);
  const [finalKills, setFinalKills] = useState<number>(0);
  const [gameOverReason, setGameOverReason] = useState<'zombie_bite' | 'wrong_answers'>('zombie_bite');

  const startSubjectGame = (subject: SubjectId) => {
    setSelectedSubject(subject);
    const questions = getQuestionsBySubject(subject);
    setActiveQuestions(questions);
    setCurrentScreen('PLAYING');
  };

  const handleGameOver = (
    score: number,
    kills: number,
    reason: 'zombie_bite' | 'wrong_answers' = 'zombie_bite'
  ) => {
    setFinalScore(score);
    setFinalKills(kills);
    setGameOverReason(reason);
    setCurrentScreen('GAME_OVER');
  };

  const handleVictory = (score: number, kills: number) => {
    setFinalScore(score);
    setFinalKills(kills);
    setCurrentScreen('VICTORY');
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 font-sans text-slate-100">
      {currentScreen === 'MENU' && (
        <MainMenu
          onStartCampaign={() => setCurrentScreen('SELECT_SUBJECT')}
          onOpenManageQuestions={() => setCurrentScreen('MANAGE_QUESTIONS')}
          onSelectSpecificSubject={(subj) => startSubjectGame(subj)}
        />
      )}

      {currentScreen === 'SELECT_SUBJECT' && (
        <SubjectSelectModal
          onSelectSubject={(subj) => startSubjectGame(subj)}
          onBack={() => setCurrentScreen('MENU')}
        />
      )}

      {currentScreen === 'MANAGE_QUESTIONS' && (
        <QuestionManager
          onBack={() => setCurrentScreen('MENU')}
          onQuestionsUpdated={() => {
            // Refresh questions if needed
          }}
        />
      )}

      {currentScreen === 'PLAYING' && (
        <GameCanvas
          questions={activeQuestions}
          subject={selectedSubject}
          onGameOver={handleGameOver}
          onVictory={handleVictory}
          onExit={() => setCurrentScreen('MENU')}
        />
      )}

      {currentScreen === 'VICTORY' && (
        <VictoryScreen
          score={finalScore}
          kills={finalKills}
          subject={selectedSubject}
          onRestart={() => startSubjectGame(selectedSubject)}
          onSelectSubject={() => setCurrentScreen('SELECT_SUBJECT')}
          onMenu={() => setCurrentScreen('MENU')}
        />
      )}

      {currentScreen === 'GAME_OVER' && (
        <GameOverScreen
          score={finalScore}
          kills={finalKills}
          subject={selectedSubject}
          reason={gameOverReason}
          onRestart={() => startSubjectGame(selectedSubject)}
          onSelectSubject={() => setCurrentScreen('SELECT_SUBJECT')}
          onMenu={() => setCurrentScreen('MENU')}
        />
      )}
    </div>
  );
}
