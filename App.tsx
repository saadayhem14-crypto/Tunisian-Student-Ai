import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { BotRole, Message, BotConfig, QuizSession, LibraryItem, QuizHistoryItem, Chapter, Flashcard } from './types';
import { BOTS } from './constants';
import { gemini } from './services/geminiService';

const App: React.FC = () => {
  const [activeBot, setActiveBot] = useState<BotConfig>(BOTS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [view, setView] = useState<'chat' | 'dashboard' | 'lms'>('chat');
  const [dashboardTab, setDashboardTab] = useState<'quizzes' | 'courses'>('courses');
  
  // Dashboard & LMS State
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([
    { id: '1', topic: 'Mathématiques - Analyse', score: 18, total: 20, date: Date.now() - 86400000 },
    { id: '2', topic: 'Algorithmique & Python', score: 15, total: 20, date: Date.now() - 272800000 }
  ]);
  const [uploadedFiles, setUploadedFiles] = useState<LibraryItem[]>([
    { title: 'Cours Algèbre Linéaire', type: 'PDF', difficulty: 'S3ib' },
    { title: 'Résumé Histoire-Géo', type: 'PDF', difficulty: 'Sahl' },
    { title: 'Série Exercices Physique', type: 'PDF', difficulty: 'Moyenn' }
  ]);

  // Active LMS Course State
  const [activeCourse, setActiveCourse] = useState<LibraryItem | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());

  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, quizSession, view]);

  const startLmsMode = async (file: LibraryItem) => {
    setIsLoading(true);
    setView('lms');
    try {
      const chapters = await gemini.decomposeCourse(file.title, "Academic content for university level.");
      const updatedFile = { ...file, chapters };
      setActiveCourse(updatedFile);
      setActiveChapterIndex(0);
      setUploadedFiles(prev => prev.map(f => f.title === file.title ? updatedFile : f));
    } catch (error) {
      console.error("LMS Decomposition failed", error);
      setView('dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFlashcard = (id: string) => {
    const newSet = new Set(flippedCards);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setFlippedCards(newSet);
  };

  const completeChapter = () => {
    if (!activeCourse) return;
    const chapters = [...activeCourse.chapters!];
    chapters[activeChapterIndex].isCompleted = true;
    const updated = { ...activeCourse, chapters };
    setActiveCourse(updated);
    setUploadedFiles(prev => prev.map(f => f.title === activeCourse.title ? updated : f));
    if (activeChapterIndex < chapters.length - 1) {
      setActiveChapterIndex(activeChapterIndex + 1);
      setFlippedCards(new Set());
    }
  };

  const startQuiz = async (topic: string) => {
    setIsLoading(true);
    try {
      const questions = await gemini.generateQuiz(topic);
      setQuizSession({
        questions,
        currentIndex: 0,
        userAnswers: [],
        score: 0,
        isComplete: false,
        topic
      });
      setView('chat');
    } catch (error) {
      console.error("Quiz fail", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;
    const currentInput = inputText.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      if (activeBot.id === BotRole.QUIZ_EXPERT && (currentInput.toLowerCase().includes('quiz') || currentInput.toLowerCase().includes('اختبار'))) {
        await startQuiz(currentInput);
        return;
      }
      const response = await gemini.generateText(activeBot, currentInput);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: response.text,
        generatedImageUrl: response.imageUrl,
        timestamp: Date.now(),
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: "فما مشكلة في الـ Connection يا بطل، عاود جرب!",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Dynamic Background Layer ---
  const DynamicBackground = () => {
    if (view === 'dashboard' || view === 'lms') {
      const icons = ['📚', '✍️', '⚛️', '🧬', '📐', '🧠', '🎓', '✏️', '🔬', '🌍'];
      return (
        <div className="dynamic-bg-container bg-dashboard-icons">
          {icons.map((icon, i) => (
            <span 
              key={i} 
              className="floating-icon" 
              style={{ animationDelay: `${i * 1.5}s`, opacity: 0.5 }}
            >
              {icon}
            </span>
          ))}
        </div>
      );
    }

    let bgClass = '';
    switch (activeBot.id) {
      case BotRole.CODING: bgClass = 'bg-coding'; break;
      case BotRole.RESUME: bgClass = 'bg-resume'; break;
      case BotRole.ORGANIZER: bgClass = 'bg-organizer'; break;
      case BotRole.QUIZ_EXPERT: bgClass = 'bg-organizer'; break; // Reusing or custom
      default: bgClass = '';
    }

    return <div className={`dynamic-bg-container ${bgClass}`} />;
  };

  // UI Components
  const CircularProgress = ({ score, total }: { score: number, total: number }) => {
    const percentage = (score / total) * 100;
    const strokeDasharray = 251.2;
    const offset = strokeDasharray - (percentage / 100) * strokeDasharray;
    return (
      <div className="relative w-32 h-32 flex items-center justify-center group">
        <div className="absolute inset-0 bg-tunisia-red/10 rounded-full blur-2xl group-hover:bg-tunisia-red/20 transition-all"></div>
        <svg className="w-full h-full transform -rotate-90 relative z-10">
          <circle cx="64" cy="64" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
          <circle cx="64" cy="64" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" 
            strokeDasharray={strokeDasharray} strokeDashoffset={offset}
            className="text-tunisia-red transition-all duration-1000 ease-out" strokeLinecap="round" />
        </svg>
        <div className="absolute flex flex-col items-center z-20">
          <span className="text-2xl font-black text-white">{Math.round(percentage)}%</span>
          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-widest">Mastery</span>
        </div>
      </div>
    );
  };

  const LmsMode = () => {
    if (!activeCourse || !activeCourse.chapters) return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center space-y-4">
           <div className="w-20 h-20 bg-tunisia-red/10 rounded-full flex items-center justify-center mx-auto text-4xl animate-pulse">⏳</div>
           <h3 className="text-2xl font-black">رانا قاعدين نقسموا في الدرس...</h3>
           <p className="text-slate-400 font-almarai italic">Cisco-style Decomposition in progress ya batal!</p>
        </div>
      </div>
    );

    const activeChapter = activeCourse.chapters[activeChapterIndex];
    const totalChapters = activeCourse.chapters.length;
    const completedCount = activeCourse.chapters.filter(c => c.isCompleted).length;
    const progressPercent = (completedCount / totalChapters) * 100;

    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-12 pb-40">
        <div className="max-w-6xl mx-auto space-y-12">
           
           {/* LMS Header & Progress */}
           <div className="glass-premium p-8 rounded-[3rem] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-3xl">📘</div>
                 <div>
                    <h2 className="text-2xl font-black text-white">{activeCourse.title}</h2>
                    <p className="text-sm text-slate-500 font-almarai mt-1">Modules: {activeChapterIndex + 1} / {totalChapters}</p>
                 </div>
              </div>
              <div className="flex-1 max-w-md">
                 <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Overall Progress</span>
                    <span className="text-[10px] font-black text-tunisia-red">{Math.round(progressPercent)}% Completed</span>
                 </div>
                 <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-tunisia-red shadow-[0_0_15px_rgba(231,0,19,0.5)] transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                 </div>
              </div>
           </div>

           {/* Chapter Navigation & Summary Dashboard */}
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
              
              {/* Sidebar: Chapters */}
              <div className="lg:col-span-1 space-y-3">
                 <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mr-4 mb-4">Course Navigator</p>
                 {activeCourse.chapters.map((ch, idx) => (
                    <button 
                      key={ch.id} 
                      onClick={() => setActiveChapterIndex(idx)}
                      className={`w-full p-5 rounded-3xl border transition-all flex items-center gap-4 text-right
                        ${activeChapterIndex === idx ? 'bg-tunisia-red text-white border-transparent crimson-shadow scale-[1.05]' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${activeChapterIndex === idx ? 'bg-white/20' : 'bg-white/10'}`}>
                        {ch.isCompleted ? '✓' : idx + 1}
                      </div>
                      <span className="font-bold text-sm truncate">{ch.title}</span>
                    </button>
                 ))}
              </div>

              {/* Main: Chapter Content */}
              <div className="lg:col-span-3 space-y-10">
                 
                 {/* Chapter Summary Dashboard */}
                 <div className="glass-premium p-10 rounded-[3rem] border border-white/10 space-y-8 animate-in slide-in-from-left-4 duration-500">
                    <div className="flex items-center justify-between border-b border-white/5 pb-6">
                       <h3 className="text-3xl font-black text-white">{activeChapter.title}</h3>
                       <div className="px-4 py-2 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-2">
                          <span className="text-xl">⏳</span>
                          <span className="text-xs font-bold text-slate-400">{activeChapter.estimatedTime}</span>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <p className="text-[10px] font-black text-tunisia-red uppercase tracking-widest">Main Goal (Zobda)</p>
                          <p className="text-lg font-almarai text-slate-200 leading-relaxed italic">"{activeChapter.goal}"</p>
                       </div>
                       <div className="space-y-4">
                          <p className="text-[10px] font-black text-tunisia-red uppercase tracking-widest">Key Concepts</p>
                          <div className="flex flex-wrap gap-2">
                             {activeChapter.concepts.map((c, i) => (
                               <span key={i} className="px-4 py-2 bg-tunisia-red/10 border border-tunisia-red/20 rounded-xl text-xs font-bold text-tunisia-red">{c}</span>
                             ))}
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Interactive Flashcards */}
                 <div className="space-y-6">
                    <div className="flex items-center justify-between px-4">
                       <h4 className="text-xl font-black text-white">بطاقات الاستذكار (Flashcards)</h4>
                       <p className="text-xs text-slate-500 font-almarai">انقر لقلب البطاقة يا بطل!</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {activeChapter.flashcards.map((card) => {
                          const isFlipped = flippedCards.has(card.id);
                          return (
                            <div 
                              key={card.id} 
                              className="flashcard-container h-56 cursor-pointer"
                              onClick={() => toggleFlashcard(card.id)}
                            >
                              <div className={`flashcard-inner relative w-full h-full transition-transform duration-700 preserve-3d ${isFlipped ? 'flipped' : ''}`}>
                                 {/* Front */}
                                 <div className="flashcard-front absolute inset-0 glass-premium p-8 rounded-[2rem] border border-white/10 flex flex-col items-center justify-center text-center backface-hidden">
                                    <span className="text-[10px] font-black text-tunisia-red uppercase tracking-widest mb-4">Question</span>
                                    <p className="text-lg font-bold font-almarai leading-snug">{card.question}</p>
                                    <div className="absolute bottom-4 right-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Tap to Flip</div>
                                 </div>
                                 {/* Back */}
                                 <div className="flashcard-back absolute inset-0 bg-tunisia-red/10 border-2 border-tunisia-red/30 p-8 rounded-[2rem] flex flex-col items-center justify-center text-center backface-hidden rotate-y-180">
                                    <span className="text-[10px] font-black text-tunisia-red uppercase tracking-widest mb-4">Answer</span>
                                    <p className="text-lg font-bold font-almarai leading-snug text-white">{card.answer}</p>
                                    <div className="mt-4 text-[10px] font-black text-emerald-500 uppercase tracking-widest">Concept Mastered!</div>
                                 </div>
                              </div>
                            </div>
                          );
                       })}
                    </div>
                 </div>

                 <div className="pt-10 flex justify-center">
                    <button 
                      onClick={completeChapter}
                      className={`px-12 py-5 rounded-3xl font-black text-lg transition-all crimson-shadow flex items-center gap-4
                        ${activeChapter.isCompleted ? 'bg-emerald-500 text-white' : 'bg-tunisia-red text-white hover:scale-105'}`}
                    >
                      {activeChapter.isCompleted ? 'Module Completed ✓' : 'Finish Chapter & Continue'}
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14m-7-7l7 7-7 7"/></svg>
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  const Dashboard = () => (
    <div className="flex-1 overflow-y-auto p-6 lg:p-12 space-y-10 custom-scrollbar pb-40">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black text-white">لوحة التحكم <span className="text-tunisia-red font-almarai text-2xl font-normal block md:inline md:mr-2">يا بطل!</span></h2>
          <p className="text-slate-500 font-almarai mt-1">تتبع تقدمك وحقق أهدافك الأكاديمية</p>
        </div>
        <div className="flex gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl">
          <button onClick={() => setDashboardTab('courses')} className={`px-8 py-2.5 rounded-xl font-bold transition-all ${dashboardTab === 'courses' ? 'bg-tunisia-red text-white shadow-lg shadow-tunisia-red/30' : 'text-slate-400 hover:text-white'}`}>المواد</button>
          <button onClick={() => setDashboardTab('quizzes')} className={`px-8 py-2.5 rounded-xl font-bold transition-all ${dashboardTab === 'quizzes' ? 'bg-tunisia-red text-white shadow-lg shadow-tunisia-red/30' : 'text-slate-400 hover:text-white'}`}>التحديات</button>
        </div>
      </div>

      {dashboardTab === 'courses' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {uploadedFiles.map((file, i) => (
            <div key={i} className="glass-premium p-8 rounded-[2.5rem] border border-white/10 hover:border-tunisia-red/30 transition-all group relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 w-32 h-32 bg-tunisia-red/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-tunisia-red/10 transition-all"></div>
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-3xl">📄</div>
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                  file.difficulty === 'S3ib' ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' : 
                  file.difficulty === 'Moyenn' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}>
                  {file.difficulty}
                </span>
              </div>
              <h4 className="text-xl font-black text-white mb-2 font-almarai leading-snug relative z-10">{file.title}</h4>
              <p className="text-xs text-slate-500 mb-8 relative z-10">
                 {file.chapters ? `${file.chapters.filter(c => c.isCompleted).length}/${file.chapters.length} Chapters Done` : 'New Material'}
              </p>
              <div className="mt-auto relative z-10">
                <button 
                  onClick={() => startLmsMode(file)}
                  className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-slate-300 group-hover:bg-tunisia-red group-hover:text-white group-hover:border-transparent transition-all crimson-shadow text-sm tracking-wide"
                >
                  {file.chapters ? 'Continue Learning' : 'Start LMS Academy'}
                </button>
              </div>
            </div>
          ))}
          <div className="border-2 border-dashed border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center p-12 hover:bg-white/5 transition-all cursor-pointer group">
             <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-3xl text-slate-500 group-hover:bg-tunisia-red group-hover:text-white transition-all mb-4">+</div>
             <p className="font-bold text-slate-500 group-hover:text-slate-300">إضافة ملف جديد</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
           <div className="lg:col-span-1 glass-premium p-10 rounded-[3rem] flex flex-col items-center justify-center text-center">
              <CircularProgress score={quizHistory.reduce((acc, q) => acc + q.score, 0)} total={quizHistory.reduce((acc, q) => acc + q.total, 0)} />
              <h4 className="mt-8 text-2xl font-black text-white">إجمالي الاستيعاب</h4>
              <p className="text-sm text-slate-500 font-almarai mt-3 leading-relaxed">خدمة غولة! راك قاعد تتحسن كل يوم. واصل يا بطل.</p>
           </div>
           <div className="lg:col-span-2 glass-premium p-10 rounded-[3rem] space-y-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-6">
                <h4 className="text-2xl font-black text-white">تاريخ التحديات</h4>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{quizHistory.length} Sessions</span>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {quizHistory.map(q => (
                  <div key={q.id} className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/5 hover:border-white/20 transition-all group">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-tunisia-red/10 flex items-center justify-center text-tunisia-red text-xl group-hover:scale-110 transition-transform">🎯</div>
                        <div>
                          <p className="font-bold text-white font-almarai text-lg">{q.topic}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter mt-1">{new Date(q.date).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black text-white">{q.score}<span className="text-sm text-slate-500 mx-1">/</span>{q.total}</p>
                        <p className={`text-[10px] font-black uppercase mt-1 ${q.score / q.total >= 0.7 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {q.score / q.total >= 0.7 ? 'خدمة غولة!' : 'عالحيط!'}
                        </p>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 font-cairo overflow-hidden selection:bg-tunisia-red selection:text-white">
      <DynamicBackground />
      
      {/* Sidebar - RTL Logic */}
      <aside className={`
        fixed inset-y-0 right-0 w-80 glass-premium z-[100] transform transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        flex flex-col border-l border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)]
      `}>
        <div className="p-8 border-b border-white/5">
           <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center p-1.5 shadow-2xl ring-2 ring-white/10">
                <img src="https://upload.wikimedia.org/wikipedia/commons/c/ce/Flag_of_Tunisia.svg" className="w-full rounded-sm" alt="TunisIA" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white leading-tight">Tunis<span className="text-tunisia-red">IA</span></h1>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em]">Student Hub Premium</p>
              </div>
           </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="space-y-2">
            <button onClick={() => {setView('dashboard'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${view === 'dashboard' ? 'bg-tunisia-red text-white crimson-shadow translate-x-[-4px]' : 'hover:bg-white/5 text-slate-400'}`}>
              <span className="text-2xl">📊</span>
              <span className="font-bold">لوحة التحكم</span>
            </button>
            <button onClick={() => {setView('chat'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${view === 'chat' ? 'bg-tunisia-red text-white crimson-shadow translate-x-[-4px]' : 'hover:bg-white/5 text-slate-400'}`}>
              <span className="text-2xl">💬</span>
              <span className="font-bold">مركز الحوار</span>
            </button>
          </div>
          
          <div className="pt-6 border-t border-white/5">
             <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4 mr-2">خبراء TunisIA</p>
             <div className="space-y-2">
               {BOTS.map(bot => (
                 <button key={bot.id} onClick={() => { setActiveBot(bot); setView('chat'); setIsSidebarOpen(false); }}
                   className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${activeBot.id === bot.id && view === 'chat' ? 'bg-white/10 border border-white/10 text-white' : 'hover:bg-white/5 text-slate-400 opacity-70 hover:opacity-100'}`}>
                   <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{bot.icon}</span>
                   <div className="text-right">
                      <p className="font-bold text-sm leading-none">{bot.name}</p>
                      <p className="text-[9px] mt-1 opacity-60 font-almarai truncate max-w-[140px]">{bot.description}</p>
                   </div>
                 </button>
               ))}
             </div>
          </div>
        </nav>
        
        <div className="p-8 bg-black/40 border-t border-white/5">
           <div className="flex items-center gap-3 text-slate-500">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-black uppercase tracking-widest">تونس ديما منورة 🇹🇳</span>
           </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[90] lg:hidden animate-in fade-in duration-300" onClick={() => setIsSidebarOpen(false)}></div>}

      <main className="flex-1 flex flex-col relative min-w-0 lg:mr-80 transition-all duration-500">
        
        <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] rounded-full blur-[160px] pointer-events-none opacity-20 transition-all duration-1000 ${activeBot.themeConfig.glowColor}`} style={{ background: activeBot.themeConfig.accentColor }} />
        
        <header className="h-20 flex items-center justify-between px-6 lg:px-12 glass-premium border-b border-white/5 z-40 sticky top-0">
           <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-3.5 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all active:scale-90"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {view === 'dashboard' ? 'لوحة التحكم' : view === 'lms' ? 'LMS Academy' : activeBot.name}
              </h2>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-3 px-6 py-2.5 rounded-full glass-card border-white/10 bg-slate-900/40">
                 <span className="w-2 h-2 rounded-full bg-tunisia-red animate-ping"></span>
                 <span className="text-xs font-black uppercase tracking-widest text-slate-300">Live AI Support</span>
              </div>
              {view === 'chat' && (
                <button onClick={() => setMessages([])} className="p-3 bg-white/5 rounded-2xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all" title="Clear Chat">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                </button>
              )}
           </div>
        </header>

        {view === 'dashboard' ? <Dashboard /> : view === 'lms' ? <LmsMode /> : (
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 lg:px-20 py-8 pb-56">
             <div className="max-w-4xl mx-auto space-y-10">
                {messages.length === 0 && (
                   <div className="py-24 text-center animate-in zoom-in-95 duration-700">
                      <div className="w-32 h-32 mx-auto rounded-[3rem] flex items-center justify-center text-6xl mb-10 shadow-2xl relative group" style={{ backgroundColor: `${activeBot.themeConfig.accentColor}20`, border: `2px solid ${activeBot.themeConfig.accentColor}40` }}>
                        <div className="absolute inset-0 rounded-[3rem] blur-xl opacity-40 group-hover:opacity-60 transition-all" style={{ backgroundColor: activeBot.themeConfig.accentColor }}></div>
                        <span className="relative z-10">{activeBot.icon}</span>
                      </div>
                      <h3 className="text-5xl font-black mb-6 tracking-tight text-white">يا بطل! 👋</h3>
                      <p className="text-2xl text-slate-400 font-almarai max-w-2xl mx-auto leading-relaxed opacity-80">
                         {activeBot.systemInstruction.split('...')[0]}... شنوا جو القراية اليوم؟
                      </p>
                      <div className="flex flex-wrap justify-center gap-3 mt-12">
                         {['كيفاش ننظم وقتي؟', 'فسرلي كود الـ Python', 'اعملي تلخيص (الزبدة)'].map(p => (
                            <button key={p} onClick={() => setInputText(p)} className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-slate-300 font-almarai hover:bg-white/10 hover:border-white/20 transition-all text-sm">{p}</button>
                         ))}
                      </div>
                   </div>
                )}
                
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'} group animate-in slide-in-from-bottom-2 duration-500`}>
                    <div className={`max-w-[92%] lg:max-w-[85%] p-7 rounded-[2.5rem] shadow-2xl border transition-all hover:scale-[1.01] ${msg.role === 'user' ? 'bg-tunisia-red text-white crimson-shadow border-tunisia-red/30 rounded-tr-none' : 'glass-premium text-slate-100 rounded-tl-none border-white/10'}`} style={msg.role === 'model' ? { borderRight: `6px solid ${activeBot.themeConfig.accentColor}` } : {}}>
                       <div className="prose prose-sm lg:prose-base max-w-none text-inherit font-almarai leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>
                       </div>
                       {msg.generatedImageUrl && (
                         <div className="mt-8 space-y-4">
                            <div className="relative group/img overflow-hidden rounded-3xl border border-white/10">
                              <img src={msg.generatedImageUrl} className="w-full transition-transform duration-700 group-hover/img:scale-105" alt="Generated Aid" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                 <p className="text-white font-black text-xs uppercase tracking-widest">Visual Aid Ready</p>
                              </div>
                            </div>
                            <button onClick={() => {}} className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-black text-xs uppercase tracking-widest border border-white/5 transition-all">Download Study Aid 📥</button>
                         </div>
                       )}
                       <p className={`text-[9px] mt-4 font-black uppercase opacity-40 tracking-widest ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </p>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-end">
                     <div className="glass-premium px-10 py-5 rounded-[2.5rem] flex items-center gap-4 border border-white/10 shadow-xl">
                        <div className="flex gap-1.5">
                           <div className="w-2.5 h-2.5 rounded-full animate-bounce bg-tunisia-red"></div>
                           <div className="w-2.5 h-2.5 rounded-full animate-bounce bg-tunisia-red [animation-delay:-.3s]"></div>
                           <div className="w-2.5 h-2.5 rounded-full animate-bounce bg-tunisia-red [animation-delay:-.5s]"></div>
                        </div>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] font-sans">Synthesizing...</span>
                     </div>
                  </div>
                )}
                <div ref={chatEndRef}></div>
             </div>
          </div>
        )}

        {/* Unified Chat Input */}
        {view === 'chat' && (
          <div className="fixed bottom-0 left-0 right-0 lg:right-80 z-50 p-4 lg:p-10 pointer-events-none">
             <div className="max-w-4xl mx-auto pointer-events-auto transform transition-all duration-300">
                <div className={`glass-premium p-2 rounded-[3rem] border shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex items-end gap-2 transition-all duration-500 
                   ${isInputFocused ? 'border-white/40 ring-8 ring-white/5 bg-slate-900/90' : 'border-white/10 bg-slate-950/60'}`}>
                   
                   <button onClick={() => fileInputRef.current?.click()} className="p-4.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-full shrink-0 transition-all active:scale-90">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                   </button>
                   
                   <input type="file" ref={fileInputRef} className="hidden" />
                   
                   <textarea
                     value={inputText}
                     onFocus={() => setIsInputFocused(true)}
                     onBlur={() => setIsInputFocused(false)}
                     onChange={(e) => setInputText(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                     placeholder={activeBot.id === BotRole.QUIZ_EXPERT ? "طلب كويز يا بطل..." : `أسهل ${activeBot.name}...`}
                     className="flex-1 bg-transparent py-4 px-3 text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none max-h-40 font-almarai text-lg transition-all"
                     rows={1}
                   />
                   
                   <button 
                     onClick={handleSend} 
                     disabled={!inputText.trim() || isLoading} 
                     className={`p-5 rounded-full transition-all shrink-0 relative overflow-hidden group
                        ${inputText.trim() && !isLoading ? 'bg-tunisia-red text-white crimson-shadow hover:scale-105 active:scale-95 shadow-xl' : 'bg-white/5 text-slate-700 cursor-not-allowed'}`}
                   >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`rotate-180 transition-transform duration-500 ${isInputFocused ? 'translate-x-1' : ''}`}>
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                   </button>
                </div>
                <div className={`h-1.5 lg:hidden mx-auto rounded-full blur-[2px] transition-all duration-700 mt-2 ${isInputFocused ? 'opacity-100 w-1/3' : 'opacity-0 w-0'}`} style={{ backgroundColor: activeBot.themeConfig.accentColor }}></div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;