/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  Droplets, 
  Settings, 
  Plus, 
  History, 
  Bell, 
  Check, 
  X, 
  User, 
  ArrowRight, 
  Trash2,
  Trophy,
  Info,
  BarChart2
} from 'lucide-react';
import { UserProfile, WaterLog, Gender } from './types';
import { calculateDailyGoal, calculateGlassSize } from './lib/waterCalculator';

// --- Constants ---
const STORAGE_KEY_PROFILE = 'aqua_reminder_profile';
const STORAGE_KEY_LOGS = 'aqua_reminder_logs';
const DEFAULT_GLASS_SIZES = [100, 200, 300, 500];

export default function App() {
  // --- State ---
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [lastReminderTime, setLastReminderTime] = useState<number>(0);
  const [activeNotification, setActiveNotification] = useState<{ id: string; amount: number } | null>(null);

  // --- Initialization ---
  useEffect(() => {
    const savedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
    const savedLogs = localStorage.getItem(STORAGE_KEY_LOGS);

    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    } else {
      setShowSetup(true);
    }

    if (savedLogs) {
      const parsedLogs: WaterLog[] = JSON.parse(savedLogs);
      setLogs(parsedLogs);
    }

    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // --- Persistence ---
  useEffect(() => {
    if (profile) {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
    }
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
  }, [logs]);

  // --- Calculations ---
  const todayLogs = useMemo(() => {
    const today = new Date().toDateString();
    return logs.filter(log => new Date(log.timestamp).toDateString() === today);
  }, [logs]);

  const baseGoal = useMemo(() => profile?.dailyGoal || 2000, [profile]);
  
  const totalDrunk = useMemo(() => todayLogs.reduce((sum, log) => sum + log.amount, 0), [todayLogs]);
  const progress = useMemo(() => Math.min((totalDrunk / baseGoal) * 100, 100), [totalDrunk, baseGoal]);
  const isGoalReached = useMemo(() => totalDrunk >= baseGoal, [totalDrunk, baseGoal]);

  const dailyChartData = useMemo(() => {
    const data = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}h`,
      amount: 0
    }));

    todayLogs.forEach(log => {
      const hour = new Date(log.timestamp).getHours();
      data[hour].amount += log.amount;
    });

    // Filter to show only hours with data or between wake/sleep
    if (!profile) return data;
    const [wakeH] = profile.wakeTime.split(':').map(Number);
    const [sleepH] = profile.sleepTime.split(':').map(Number);
    
    return data.filter((d, i) => d.amount > 0 || (i >= wakeH && i <= sleepH));
  }, [todayLogs, profile]);

  const weeklyChartData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateStr = date.toDateString();
      const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' });
      
      const dayAmount = logs
        .filter(log => new Date(log.timestamp).toDateString() === dateStr)
        .reduce((sum, log) => sum + log.amount, 0);
        
      data.push({
        name: dayName.charAt(0).toUpperCase() + dayName.slice(1),
        amount: dayAmount,
        goal: profile?.dailyGoal || 2000,
        fullDate: date.toLocaleDateString('pt-BR')
      });
    }
    return data;
  }, [logs, profile]);

  // --- Reminder Logic ---
  useEffect(() => {
    if (!profile) return;

    const checkReminder = () => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      const [wakeH, wakeM] = profile.wakeTime.split(':').map(Number);
      const [sleepH, sleepM] = profile.sleepTime.split(':').map(Number);
      const wakeMinutes = wakeH * 60 + wakeM;
      const sleepMinutes = sleepH * 60 + sleepM;

      // Check if within waking hours
      const isWakingHours = wakeMinutes < sleepMinutes 
        ? (currentMinutes >= wakeMinutes && currentMinutes <= sleepMinutes)
        : (currentMinutes >= wakeMinutes || currentMinutes <= sleepMinutes);

      if (!isWakingHours) return;

      // Check interval
      const timeSinceLast = (now.getTime() - lastReminderTime) / (1000 * 60);
      const isIntervalTrigger = timeSinceLast >= profile.reminderInterval;

      // Check custom times
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${h}:${m}`;
      const isCustomTimeTrigger = profile.customReminderTimes.includes(currentTimeStr) && timeSinceLast >= 1;

      if (isIntervalTrigger || isCustomTimeTrigger) {
        triggerReminder();
      }
    };

    const intervalId = setInterval(checkReminder, 60000); // Check every minute
    return () => clearInterval(intervalId);
  }, [profile, lastReminderTime]);

  const triggerReminder = () => {
    const glassSize = profile ? calculateGlassSize(profile.dailyGoal, profile.wakeTime, profile.sleepTime, profile.reminderInterval) : 250;
    
    // In-app notification
    setActiveNotification({ id: Math.random().toString(36).substr(2, 9), amount: glassSize });
    setLastReminderTime(Date.now());

    // Browser notification
    if (notificationPermission === 'granted') {
      new Notification('Hora de beber água!', {
        body: `Beba ${glassSize}ml para manter sua meta diária.`,
        icon: 'https://cdn-icons-png.flaticon.com/512/3105/3105807.png'
      });
    }
  };

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  // --- Handlers ---
  const addWater = (amount: number) => {
    const newLog: WaterLog = {
      id: Math.random().toString(36).substr(2, 9),
      amount,
      timestamp: Date.now()
    };
    setLogs(prev => [newLog, ...prev]);
    if (activeNotification) setActiveNotification(null);
  };

  const removeLog = (id: string) => {
    setLogs(prev => prev.filter(log => log.id !== id));
  };

  const handleSetupComplete = (data: Partial<UserProfile>) => {
    const calculatedGoal = calculateDailyGoal(data.weight!, data.height!, data.gender!);
    const newProfile: UserProfile = {
      weight: data.weight!,
      height: data.height!,
      gender: data.gender!,
      dailyGoal: data.dailyGoal || calculatedGoal,
      reminderInterval: 60, // Default 60 mins
      wakeTime: '07:00',
      sleepTime: '22:00',
      customReminderTimes: [],
      theme: 'blue',
      ...data as UserProfile
    };
    setProfile(newProfile);
    setShowSetup(false);
    setShowSettings(false);
  };

// --- Components ---
  const BackgroundBlobs = () => (
    <>
      <div className="blob w-[500px] h-[500px] bg-blue-200 -top-24 -left-24" />
      <div className="blob w-[400px] h-[400px] bg-cyan-100 top-1/2 -right-24 animation-delay-2000" />
      <div className="blob w-[300px] h-[300px] bg-indigo-100 -bottom-24 left-1/4 animation-delay-4000" />
    </>
  );

  const SetupForm = ({ initialData }: { initialData?: UserProfile }) => {
    const [weight, setWeight] = useState(initialData?.weight || 70);
    const [height, setHeight] = useState(initialData?.height || 170);
    const [gender, setGender] = useState<Gender>(initialData?.gender || 'masculino');
    const [wakeTime, setWakeTime] = useState(initialData?.wakeTime || '07:00');
    const [sleepTime, setSleepTime] = useState(initialData?.sleepTime || '22:00');
    const [interval, setInterval] = useState(initialData?.reminderInterval || 60);
    const [customTimes, setCustomTimes] = useState<string[]>(initialData?.customReminderTimes || []);
    const [newTime, setNewTime] = useState('10:00');
    const [isManualGoal, setIsManualGoal] = useState(!!initialData?.dailyGoal);
    const [manualGoal, setManualGoal] = useState(initialData?.dailyGoal || 2000);
    const [theme, setTheme] = useState(initialData?.theme || 'blue');

    const calculatedGoal = useMemo(() => calculateDailyGoal(weight, height, gender), [weight, height, gender]);

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-[3rem] p-10 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar shadow-2xl border-white/60"
      >
        <div className="text-center space-y-2 mb-4">
          <h2 className="text-2xl font-display font-bold text-slate-900">Seu Perfil</h2>
          <p className="text-sm text-slate-400 font-medium">Personalize sua experiência de hidratação</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Peso (kg)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-full bg-white/50 border border-white/60 rounded-2xl px-5 py-4 text-slate-800 font-bold focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Altura (cm)</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full bg-white/50 border border-white/60 rounded-2xl px-5 py-4 text-slate-800 font-bold focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all"
              required
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Sexo</label>
          <div className="grid grid-cols-2 gap-4">
            {(['masculino', 'feminino'] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`py-4 rounded-2xl font-bold transition-all border ${
                  gender === g 
                    ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20' 
                    : 'bg-white/50 text-slate-600 border-white/60 hover:bg-white/80'
                }`}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tema</label>
          <div className="grid grid-cols-4 gap-2">
            {['blue', 'emerald', 'rose', 'violet'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`h-12 rounded-2xl transition-all border-2 ${
                  theme === t ? 'border-brand-primary scale-105' : 'border-transparent'
                } bg-${t === 'blue' ? 'blue' : t === 'emerald' ? 'emerald' : t === 'rose' ? 'rose' : 'violet'}-500`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4 p-6 bg-brand-primary/10 rounded-[2rem] border border-brand-primary/20">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-bold text-slate-700">Meta Diária</label>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {isManualGoal ? 'Manual' : 'Automática'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsManualGoal(!isManualGoal)}
              className={`w-12 h-6 rounded-full transition-colors relative ${isManualGoal ? 'bg-brand-primary' : 'bg-slate-300'}`}
            >
              <motion.div 
                animate={{ x: isManualGoal ? 26 : 2 }}
                className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm"
              />
            </button>
          </div>
          {isManualGoal ? (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="relative">
              <input
                type="number"
                value={manualGoal}
                onChange={(e) => setManualGoal(Number(e.target.value))}
                className="w-full bg-white border border-brand-primary/20 rounded-2xl px-5 py-4 text-brand-primary font-display font-bold text-xl outline-none"
                placeholder="Ex: 2500"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-primary font-bold">ml</span>
            </motion.div>
          ) : (
            <div className="p-4 bg-white/60 rounded-2xl flex justify-between items-center border border-brand-primary/20">
              <span className="text-xs font-bold text-brand-primary uppercase tracking-widest">Sugerida</span>
              <span className="text-xl font-display font-bold text-brand-primary">{calculatedGoal}ml</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Acordar</label>
            <input
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="w-full bg-white/50 border border-white/60 rounded-2xl px-5 py-4 text-slate-800 font-bold outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Dormir</label>
            <input
              type="time"
              value={sleepTime}
              onChange={(e) => setSleepTime(e.target.value)}
              className="w-full bg-white/50 border border-white/60 rounded-2xl px-5 py-4 text-slate-800 font-bold outline-none"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Lembrete a cada</label>
            <select
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              className="w-full bg-white/50 border border-white/60 rounded-2xl px-5 py-4 text-slate-800 font-bold outline-none appearance-none"
            >
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
              <option value={90}>1 hora e 30 min</option>
              <option value={120}>2 horas</option>
            </select>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Horários Customizados</label>
            <div className="flex gap-3">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="flex-1 bg-white/50 border border-white/60 rounded-2xl px-5 py-4 text-slate-800 font-bold outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (!customTimes.includes(newTime)) {
                    setCustomTimes([...customTimes, newTime].sort());
                  }
                }}
                className="px-6 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {customTimes.map((time) => (
                <motion.span 
                  key={time} 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold border border-blue-100"
                >
                  {time}
                  <button type="button" onClick={() => setCustomTimes(customTimes.filter(t => t !== time))} className="hover:text-red-500">
                    <X size={14} />
                  </button>
                </motion.span>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => handleSetupComplete({ 
            weight, 
            height, 
            gender, 
            wakeTime, 
            sleepTime, 
            reminderInterval: interval,
            customReminderTimes: customTimes,
            dailyGoal: isManualGoal ? manualGoal : calculatedGoal,
            theme
          })}
          className="w-full bg-gradient-to-r from-brand-primary to-brand-secondary text-white py-5 rounded-[2rem] font-display font-bold text-lg shadow-xl shadow-brand-primary/20 hover:shadow-brand-primary/40 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
        >
          {initialData ? 'Salvar Alterações' : 'Começar Agora'}
          <ArrowRight size={20} />
        </button>

        {initialData && (
          <button
            onClick={() => {
              // No window.confirm as per instructions, but for a reset we should be careful.
              // For now I'll just clear it, but in a real app I'd use a custom modal.
              localStorage.clear();
              window.location.reload();
            }}
            className="w-full py-2 text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-red-500 transition-colors"
          >
            Resetar Aplicativo
          </button>
        )}
      </motion.div>
    );
  };

  if (showSetup) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <SetupForm />
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans selection:bg-brand-primary/20 selection:text-brand-primary theme-${profile?.theme || 'blue'}`}>
      <BackgroundBlobs />
      
      {/* Header */}
      <header className="sticky top-0 z-40 w-full px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between glass rounded-3xl px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-200">
              <Droplets className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-display font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              AquaReminder
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowStats(true)}
              className="p-2.5 rounded-xl hover:bg-white/50 text-slate-600 transition-all active:scale-95"
              title="Estatísticas"
            >
              <BarChart2 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowHistory(true)}
              className="p-2.5 rounded-xl hover:bg-white/50 text-slate-600 transition-all active:scale-95"
              title="Histórico"
            >
              <History className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2.5 rounded-xl hover:bg-white/50 text-slate-600 transition-all active:scale-95"
              title="Configurações"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-24 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Progress */}
          <div className="lg:col-span-7 space-y-8">
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-[3rem] p-10 relative overflow-hidden water-wave"
            >
              <div className="relative z-10 space-y-8">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-500/80">Progresso Diário</span>
                    <h2 className="text-2xl font-display font-bold text-slate-900">
                      {totalDrunk} <span className="text-base font-medium text-slate-400">ml</span>
                    </h2>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Meta</span>
                    <p className="text-lg font-display font-semibold text-slate-700">{baseGoal}ml</p>
                  </div>
                </div>

                {/* Progress Visualizer */}
                <div className="relative h-4 w-full bg-white/50 rounded-full overflow-hidden border border-white/40 shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "spring", bounce: 0, duration: 1 }}
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-400 shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    {isGoalReached ? 'Meta atingida! Parabéns!' : `${Math.round(progress)}% concluído`}
                  </div>
                  {isGoalReached && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      EXCELENTE
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.section>

            {/* Quick Add Section */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 ml-6">Adicionar Rápido</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {DEFAULT_GLASS_SIZES.map((size, idx) => (
                  <motion.button
                    key={size}
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => addWater(size)}
                    className="glass p-5 rounded-[2rem] flex flex-col items-center gap-3 group transition-all hover:bg-white/80 border-white/60"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white transition-colors text-brand-primary">
                      {size <= 200 ? <Droplets className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                    </div>
                    <div className="text-center">
                      <span className="block text-lg font-display font-bold text-slate-800">{size}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ml</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Info */}
          <div className="lg:col-span-5 space-y-8">
            {/* Info Card */}
            <motion.section 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-dark rounded-[2.5rem] p-8 text-white relative overflow-hidden"
            >
              <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl" />
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Info className="w-5 h-5 text-blue-300" />
                  </div>
                  <h3 className="text-sm font-bold tracking-wide">Dica de Saúde</h3>
                </div>
                <p className="text-blue-100/80 text-sm leading-relaxed font-medium">
                  Beber água regularmente aumenta seus níveis de energia, melhora a função cerebral e ajuda a manter o peso ideal.
                </p>
                <div className="pt-2">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl text-xs font-bold hover:bg-white/20 transition-colors cursor-pointer">
                    Saiba mais <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </motion.section>
          </div>
        </div>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <motion.button
          whileHover={{ scale: 1.05, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => addWater(250)}
          className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-2xl shadow-blue-400/40 flex items-center justify-center transition-all shimmer"
        >
          <Plus className="w-8 h-8" />
        </motion.button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {/* Settings Modal */}
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="w-full max-w-md relative"
            >
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute -top-14 right-0 text-white/70 hover:text-white p-2 transition-colors"
              >
                <X size={28} />
              </button>
              <SetupForm initialData={profile!} />
            </motion.div>
          </motion.div>
        )}

        {/* History Modal */}
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-md glass rounded-t-[3rem] sm:rounded-[3rem] p-8 max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="space-y-1">
                  <h2 className="text-xl font-display font-bold text-slate-900">Histórico</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Registros de hoje</p>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto text-slate-200">
                    <Droplets size={40} />
                  </div>
                  <p className="text-slate-400 font-medium">Nenhum registro hoje.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {todayLogs.map((log) => (
                    <motion.div 
                      layout
                      key={log.id} 
                      className="flex items-center justify-between p-5 bg-white/60 rounded-[2rem] group border border-white/40 hover:bg-white/80 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 shadow-sm">
                          <Droplets size={22} />
                        </div>
                        <div>
                          <p className="font-display font-bold text-slate-800 text-lg">{log.amount} <span className="text-sm font-medium text-slate-400">ml</span></p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeLog(log.id)}
                        className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Stats Modal */}
        {showStats && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-3xl glass rounded-t-[3rem] sm:rounded-[3rem] p-10 max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex justify-between items-center mb-10">
                <div className="space-y-1">
                  <h2 className="text-2xl font-display font-bold text-slate-900">Estatísticas</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Análise de consumo</p>
                </div>
                <button 
                  onClick={() => setShowStats(false)}
                  className="p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Daily Chart */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">Consumo por Hora</h3>
                  <div className="h-64 w-full bg-white/40 rounded-[2.5rem] p-6 border border-white/40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyChartData}>
                        <XAxis 
                          dataKey="hour" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
                        />
                        <Tooltip 
                          cursor={{ fill: 'rgba(59, 130, 246, 0.05)', radius: 8 }}
                          contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                          itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}
                          labelStyle={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                          formatter={(value: number) => [`${value}ml`, 'Quantidade']}
                        />
                        <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 6, 6]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Weekly Chart */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">Últimos 7 Dias</h3>
                  <div className="h-64 w-full bg-white/40 rounded-[2.5rem] p-6 border border-white/40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyChartData}>
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
                        />
                        <Tooltip 
                          cursor={{ fill: 'rgba(59, 130, 246, 0.05)', radius: 8 }}
                          contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                          itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}
                          labelStyle={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                          formatter={(value: number) => [`${value}ml`, 'Total']}
                        />
                        <Bar dataKey="amount" radius={[8, 8, 8, 8]} barSize={24}>
                          {weeklyChartData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.amount >= entry.goal ? '#10b981' : '#3b82f6'} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 justify-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
                      <span>Em progresso</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                      <span>Meta atingida</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Active Notification Toast */}
        {activeNotification && (
          <motion.div 
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className="fixed top-24 right-6 left-6 sm:left-auto sm:w-80 glass p-5 rounded-[2rem] shadow-2xl border-white/60 z-[60] flex items-center gap-4 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 shrink-0">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">Hora de beber água!</p>
              <p className="text-xs font-medium text-slate-400">Beba <span className="text-blue-500 font-bold">{activeNotification.amount}ml</span> agora.</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => addWater(activeNotification.amount)}
                className="p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-200"
              >
                <Check size={18} />
              </button>
              <button 
                onClick={() => setActiveNotification(null)}
                className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
