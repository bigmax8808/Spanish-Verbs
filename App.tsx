
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tense, VerbCategory, Subject, PracticeStats, Feedback, VerbData } from './types';
import { VERB_POOL, SUBJECTS } from './constants';
import { getRandomItem, checkAnswer } from './utils';
import { getVerbTip, speakText } from './geminiService';

const App: React.FC = () => {
  // Config State
  const [selectedTense, setSelectedTense] = useState<Tense>(Tense.PRESENT);
  const [selectedCategory, setSelectedCategory] = useState<VerbCategory>(VerbCategory.REGULAR);
  
  // Game State
  const [currentVerb, setCurrentVerb] = useState<VerbData | null>(null);
  const [currentSubject, setCurrentSubject] = useState<Subject | null>(null);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [geminiTip, setGeminiTip] = useState<string | null>(null);
  const [isLoadingTip, setIsLoadingTip] = useState(false);
  const [showConjugationChart, setShowConjugationChart] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // We use a Ref to track the last verb to ensure the verb changes every round
  const lastVerbInfinitiveRef = useRef<string | null>(null);

  // Stats State
  const [stats, setStats] = useState<PracticeStats>({
    correct: 0,
    incorrect: 0,
    total: 0
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const startNewRound = useCallback(() => {
    const filteredVerbs = VERB_POOL.filter(v => v.category === selectedCategory);
    
    if (filteredVerbs.length === 0) return;

    // Filter out the last verb to ensure a new one is selected if possible
    let pool = filteredVerbs;
    if (lastVerbInfinitiveRef.current && filteredVerbs.length > 1) {
      pool = filteredVerbs.filter(v => v.infinitive !== lastVerbInfinitiveRef.current);
    }

    const verb = getRandomItem(pool);
    const subject = getRandomItem(SUBJECTS);
    
    lastVerbInfinitiveRef.current = verb.infinitive;
    setCurrentVerb(verb);
    setCurrentSubject(subject);
    setUserInput('');
    setFeedback(null);
    setGeminiTip(null);
    setShowConjugationChart(false);
    
    // Defer focus to ensure the input is enabled
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  }, [selectedCategory, selectedTense]);

  const resetStats = () => {
    setStats({ correct: 0, incorrect: 0, total: 0 });
  };

  const handleSpeak = async (text: string) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    await speakText(text);
    setIsSpeaking(false);
  };

  useEffect(() => {
    startNewRound();
  }, [selectedCategory, selectedTense, startNewRound]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback || !currentVerb || !currentSubject) return;

    const correctAnswer = currentVerb.conjugations[selectedTense][currentSubject];
    const result = checkAnswer(userInput, correctAnswer);

    const newFeedback: Feedback = {
      isCorrect: result.isCorrect,
      isAccentError: result.isAccentError,
      correctAnswer,
      userAnswer: userInput
    };

    setFeedback(newFeedback);
    setStats(prev => ({
      ...prev,
      correct: prev.correct + (result.isCorrect ? 1 : 0),
      incorrect: prev.incorrect + (result.isCorrect ? 0 : 1),
      total: prev.total + 1
    }));

    // Fetch context tip from Gemini for every answer to enhance learning
    setIsLoadingTip(true);
    const tip = await getVerbTip(currentVerb.infinitive, selectedTense, currentSubject);
    setGeminiTip(tip);
    setIsLoadingTip(false);
  };

  const handleNext = () => {
    startNewRound();
  };

  const percentCorrect = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-4xl mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-2 tracking-tight">
          Conjugate<span className="text-blue-600">Pro</span> Spanish
        </h1>
        <p className="text-slate-500 font-medium">Master your Spanish tenses with precision</p>
      </header>

      <main className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-8 pb-32">
        
        {/* Settings Panel */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-6 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
              <SettingsIcon /> Settings
            </h2>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Tense</label>
            <div className="flex flex-col gap-2">
              {Object.values(Tense).map(tense => (
                <button
                  key={tense}
                  onClick={() => setSelectedTense(tense)}
                  className={`px-4 py-3 rounded-xl font-medium transition-all text-left ${
                    selectedTense === tense 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tense}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Verb Type</label>
            <div className="flex flex-col gap-2">
              {Object.values(VerbCategory).map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-3 rounded-xl font-medium transition-all text-left ${
                    selectedCategory === cat 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-50">
             <button 
                onClick={resetStats}
                className="w-full py-2 px-4 border-2 border-slate-200 text-slate-400 font-bold rounded-xl hover:border-red-200 hover:text-red-500 transition-all flex items-center justify-center gap-2"
              >
                <ResetIcon /> Reset Stats
              </button>
          </div>
        </section>

        {/* Practice Area */}
        <section className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 flex gap-2">
              <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full uppercase">
                {selectedTense} Practice
              </span>
            </div>

            {currentVerb && currentSubject ? (
              <div className="flex flex-col items-center text-center">
                <div className="mb-4">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <h3 className="text-5xl font-bold text-slate-800 accent-font">
                      {currentVerb.infinitive}
                    </h3>
                    <button 
                      onClick={() => handleSpeak(currentVerb.infinitive)}
                      disabled={isSpeaking}
                      className="p-2 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-30"
                      title="Listen"
                    >
                      <SpeakerIcon />
                    </button>
                  </div>
                  
                  {/* Conditional Meaning Display */}
                  <div className="h-8 mb-4">
                    {feedback ? (
                      <p className="text-slate-400 italic text-lg capitalize animate-in fade-in duration-500">
                        {currentVerb.meaning}
                      </p>
                    ) : (
                      <p className="text-slate-200 italic text-lg capitalize">
                        (Translation hidden)
                      </p>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => setShowConjugationChart(!showConjugationChart)}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 mx-auto"
                  >
                    <BookOpenIcon /> {showConjugationChart ? 'Hide' : 'Show'} Conjugation Chart
                  </button>
                </div>

                <div className="w-full flex flex-col items-center gap-6 mt-8">
                  {/* Subject and Input Alignment */}
                  <div className="flex items-center justify-center gap-6 text-2xl font-semibold text-slate-600 w-full">
                    <div className="h-16 flex items-center justify-center bg-slate-50 px-6 rounded-2xl border border-slate-100 min-w-[140px] shadow-sm">
                      {currentSubject}
                    </div>
                    
                    <span className="text-slate-300">→</span>
                    
                    <form onSubmit={handleSubmit} className="flex-1 max-w-xs">
                      <input
                        ref={inputRef}
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        disabled={!!feedback}
                        placeholder="Conjugate..."
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        className={`w-full h-16 px-4 border-b-4 focus:outline-none transition-all text-center font-bold bg-transparent rounded-t-lg ${
                          feedback 
                            ? feedback.isCorrect 
                              ? 'border-green-500 text-green-600' 
                              : 'border-red-500 text-red-600'
                            : 'border-slate-200 focus:border-blue-400 text-slate-500'
                        }`}
                      />
                    </form>
                  </div>

                  {!feedback ? (
                    <button 
                      onClick={handleSubmit}
                      className="mt-4 px-10 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-slate-200"
                    >
                      Check Answer
                    </button>
                  ) : (
                    <div className="w-full mt-4 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className={`p-6 rounded-2xl w-full max-w-md ${
                        feedback.isCorrect ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
                      }`}>
                        {feedback.isCorrect ? (
                          <div className="text-center">
                            <p className="text-green-700 font-bold text-xl flex items-center justify-center gap-2">
                              <CheckCircleIcon /> Correct!
                            </p>
                            <div className="mt-2 flex items-center justify-center gap-2">
                              <span className="text-slate-600">Well done:</span>
                              <span className="font-bold text-green-700 text-lg">{feedback.correctAnswer}</span>
                              <button 
                                onClick={() => handleSpeak(feedback.correctAnswer)}
                                disabled={isSpeaking}
                                className="p-1 text-slate-400 hover:text-green-600 transition-colors disabled:opacity-30"
                              >
                                <SpeakerIcon size={18} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center">
                            <p className="text-red-700 font-bold text-xl flex items-center justify-center gap-2">
                              <XCircleIcon /> {feedback.isAccentError ? 'Accent Error' : 'Incorrect'}
                            </p>
                            {feedback.isAccentError && (
                              <p className="text-amber-600 font-semibold mt-1 text-sm">
                                Accurate accents are required!
                              </p>
                            )}
                            <div className="mt-2 flex items-center justify-center gap-2">
                              <span className="text-slate-600">Correct spelling:</span>
                              <span className="font-bold text-red-700 text-lg underline decoration-wavy decoration-red-300">{feedback.correctAnswer}</span>
                              <button 
                                onClick={() => handleSpeak(feedback.correctAnswer)}
                                disabled={isSpeaking}
                                className="p-1 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-30"
                              >
                                <SpeakerIcon size={18} />
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Gemini Tip Integration */}
                        <div className="mt-6 pt-4 border-t border-slate-200 text-slate-600 text-sm">
                          {isLoadingTip ? (
                            <div className="flex items-center justify-center gap-2 italic text-slate-400">
                              <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-75"></div>
                              <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-150"></div>
                            </div>
                          ) : geminiTip ? (
                            <div className="italic text-center leading-relaxed text-slate-500">
                              &ldquo;{geminiTip}&rdquo;
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <button 
                        onClick={handleNext}
                        className="mt-8 px-10 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 active:scale-95"
                      >
                        Next Verb <ArrowRightIcon />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-slate-400">
                Loading practice set...
              </div>
            )}
          </div>

          {/* Stats Display */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Correct" value={stats.correct} color="green" />
            <StatCard label="Incorrect" value={stats.incorrect} color="red" />
            <StatCard label="Accuracy" value={`${percentCorrect}%`} color="blue" />
          </div>
        </section>
      </main>

      {/* Floating Conjugation Chart Window */}
      {showConjugationChart && currentVerb && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-8 animate-in slide-in-from-bottom duration-300">
          <div className="max-w-4xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-l border-r border-slate-200 overflow-hidden">
            <div className="bg-slate-800 px-6 py-4 flex items-center justify-between text-white">
              <h4 className="text-xl font-bold flex items-center gap-2 capitalize">
                <BookOpenIcon /> {currentVerb.infinitive} ({selectedTense})
              </h4>
              <button 
                onClick={() => setShowConjugationChart(false)}
                className="p-1 hover:bg-slate-700 rounded-full transition-colors"
                aria-label="Close chart"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {SUBJECTS.map((subj) => (
                <div key={subj} className={`p-4 rounded-2xl border transition-colors ${subj === currentSubject ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">{subj}</div>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-xl font-bold ${subj === currentSubject ? 'text-blue-700' : 'text-slate-700'}`}>
                      {currentVerb.conjugations[selectedTense][subj]}
                    </div>
                    <button 
                      onClick={() => handleSpeak(currentVerb.conjugations[selectedTense][subj])}
                      disabled={isSpeaking}
                      className="p-1 text-slate-300 hover:text-blue-500 transition-colors disabled:opacity-30"
                    >
                      <SpeakerIcon size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="mt-auto py-8 text-slate-400 text-sm flex items-center gap-4">
        <span>&copy; 2024 ConjugatePro Spanish</span>
        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
        <button 
          onClick={resetStats}
          className="hover:text-slate-600 transition-colors underline decoration-dotted"
        >
          Reset Statistics
        </button>
      </footer>
    </div>
  );
};

// Subcomponents

const StatCard: React.FC<{ label: string; value: string | number; color: 'green' | 'red' | 'blue' }> = ({ label, value, color }) => {
  const colors = {
    green: 'text-green-600 bg-green-50 border-green-100',
    red: 'text-red-600 bg-red-50 border-red-100',
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
  };

  return (
    <div className={`p-4 rounded-2xl border text-center transition-all hover:scale-105 shadow-sm ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</div>
    </div>
  );
};

// Icons

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);

const ResetIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
);

const BookOpenIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

const SpeakerIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
);

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);

const XCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
);

const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
);

export default App;
