import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Pill, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  Circle, 
  ChevronRight, 
  Trash2, 
  Bell,
  X,
  AlertCircle,
  Home,
  BarChart2,
  Settings,
  User,
  Utensils
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Medication, DoseLog } from './types';

// --- Components ---

const Card = ({ children, className = "", ...props }: { children: React.ReactNode, className?: string, [key: string]: any }) => (
  <div className={`premium-card p-5 ${className}`} {...props}>
    {children}
  </div>
);

const Button = ({ children, className = "", variant = "primary", ...props }: { children: React.ReactNode, className?: string, variant?: "primary" | "outline", [key: string]: any }) => {
  const baseStyles = "flex items-center justify-center gap-2 font-bold transition-all active:scale-95";
  const variants = {
    primary: "bg-gold text-black hover:bg-gold/90",
    outline: "border border-slate-700 text-slate-300 hover:bg-slate-800"
  };
  
  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const NavItem = ({ icon: Icon, label, active = false, subtext = "" }: { icon: any, label: string, active?: boolean, subtext?: string }) => (
  <div className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${active ? 'text-gold' : 'text-slate-500 hover:text-slate-300'}`}>
    <Icon className="w-6 h-6" />
    <span className="text-[10px] font-medium uppercase tracking-tighter">{label}</span>
    {subtext && <span className="text-[8px] opacity-60 -mt-1">{subtext}</span>}
  </div>
);

// --- Main App ---

export default function App() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('home');
  const [dueDose, setDueDose] = useState<{ med: Medication, time: string } | null>(null);
  const [lastNotified, setLastNotified] = useState<string>('');
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [deletingMedicationId, setDeletingMedicationId] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const audioContext = React.useRef<AudioContext | null>(null);
  const oscillator = React.useRef<OscillatorNode | null>(null);

  const playAlarm = () => {
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      if (audioContext.current.state === 'suspended') {
        audioContext.current.resume();
      }

      oscillator.current = audioContext.current.createOscillator();
      const gainNode = audioContext.current.createGain();

      oscillator.current.type = 'square';
      oscillator.current.frequency.setValueAtTime(440, audioContext.current.currentTime); // A4
      
      // Create a beeping effect
      gainNode.gain.setValueAtTime(0, audioContext.current.currentTime);
      gainNode.gain.setTargetAtTime(0.1, audioContext.current.currentTime, 0.01);
      
      oscillator.current.connect(gainNode);
      gainNode.connect(audioContext.current.destination);

      oscillator.current.start();
      
      // Beeping pattern
      const beepInterval = setInterval(() => {
        if (!oscillator.current || !audioContext.current) {
          clearInterval(beepInterval);
          return;
        }
        const now = audioContext.current.currentTime;
        gainNode.gain.setTargetAtTime(0.1, now, 0.01);
        gainNode.gain.setTargetAtTime(0, now + 0.5, 0.01);
      }, 1000);

    } catch (e) {
      console.error("Audio play failed:", e);
    }
  };

  const stopAlarm = () => {
    if (oscillator.current) {
      try {
        oscillator.current.stop();
        oscillator.current.disconnect();
        oscillator.current = null;
      } catch (e) {
        console.error("Audio stop failed:", e);
      }
    }
  };

  // Load data
  useEffect(() => {
    const savedMeds = localStorage.getItem('medremind_meds');
    const savedLogs = localStorage.getItem('medremind_logs');
    
    if (savedMeds) {
      setMedications(JSON.parse(savedMeds));
    } else {
      const initialMeds: Medication[] = [
        {
          id: '1',
          name: 'Atorvastatin',
          frequency: 'daily',
          times: ['07:30'],
          startDate: new Date().toISOString(),
          color: '#3b82f6',
          instructions: 'After Food'
        },
        {
          id: '2',
          name: 'Vitamin D3 & Magnesium',
          frequency: 'daily',
          times: ['12:15'],
          startDate: new Date().toISOString(),
          color: '#8b5cf6',
          instructions: 'After Food'
        },
        {
          id: '3',
          name: 'Metformin (500mg)',
          frequency: 'daily',
          times: ['21:00'],
          startDate: new Date().toISOString(),
          color: '#f59e0b',
          instructions: 'After Food',
          totalPills: 30,
          takenPills: 13
        }
      ];
      setMedications(initialMeds);
      
      // Mock logs for today
      const today = new Date().toLocaleDateString();
      const initialLogs: DoseLog[] = [
        { id: 'l1', medicationId: '1', timestamp: new Date().toISOString(), status: 'taken' },
        { id: 'l2', medicationId: '2', timestamp: new Date().toISOString(), status: 'taken' }
      ];
      setLogs(initialLogs);
    }

    if (savedLogs) setLogs(JSON.parse(savedLogs));

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Request Notification Permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      clearInterval(timer);
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  // Notification Checker
  useEffect(() => {
    const checkNotifications = () => {
      const now = new Date();
      const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      
      // Only check once per minute
      if (timeStr === lastNotified) return;

      medications.forEach(med => {
        if (!isMedicationScheduledForToday(med)) return;

        med.times.forEach(time => {
          if (time === timeStr && !isDoseTakenToday(med.id, time)) {
            // Trigger Notification
            if ("Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(`Time for your ${med.name}`, {
                  body: `Scheduled for ${time}. ${med.instructions || ''}`,
                  icon: '/favicon.ico'
                });
              } catch (e) {
                console.error("Notification error:", e);
              }
            }
            
            // Trigger In-App Alert
            setDueDose({ med, time });
            playAlarm();
            setLastNotified(timeStr);
          }
        });
      });
    };

    const interval = setInterval(checkNotifications, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [medications, logs, lastNotified]);

  // Save data
  useEffect(() => {
    localStorage.setItem('medremind_meds', JSON.stringify(medications));
    localStorage.setItem('medremind_logs', JSON.stringify(logs));
  }, [medications, logs]);

  const addMedication = (med: Omit<Medication, 'id'>) => {
    const newMed = { ...med, id: crypto.randomUUID() };
    setMedications([...medications, newMed]);
    setIsAddModalOpen(false);
  };

  const updateMedication = (updatedMed: Medication) => {
    setMedications(medications.map(m => m.id === updatedMed.id ? updatedMed : m));
    setEditingMedication(null);
  };

  const deleteMedication = (id: string) => {
    setDeletingMedicationId(id);
  };

  const confirmDelete = () => {
    if (deletingMedicationId) {
      setMedications(medications.filter(m => m.id !== deletingMedicationId));
      setLogs(logs.filter(l => l.medicationId !== deletingMedicationId));
      setDeletingMedicationId(null);
    }
  };

  const confirmReset = () => {
    setMedications([]);
    setLogs([]);
    localStorage.clear();
    setIsResetConfirmOpen(false);
  };

  const logDose = (medicationId: string, status: 'taken' | 'skipped') => {
    const newLog: DoseLog = {
      id: crypto.randomUUID(),
      medicationId,
      timestamp: new Date().toISOString(),
      status
    };
    setLogs([newLog, ...logs]);
  };

  const isDoseTakenToday = (medId: string, timeStr: string) => {
    const today = new Date().toLocaleDateString();
    return logs.some(log => {
      const logDate = new Date(log.timestamp).toLocaleDateString();
      // In a real app, we'd match the specific time slot
      return log.medicationId === medId && logDate === today && log.status === 'taken';
    });
  };

  const isMedicationScheduledForToday = (med: Medication) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sunday

    if (med.frequency === 'daily') return true;
    if (med.frequency === 'as-needed') return true;
    if (med.frequency === 'weekly' && med.daysOfWeek) {
      return med.daysOfWeek.includes(dayOfWeek);
    }
    return false;
  };

  const getUpcomingDose = () => {
    const now = new Date();
    const currentTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    const allDoses: { med: Medication, time: string }[] = [];
    medications.forEach(med => {
      if (!isMedicationScheduledForToday(med)) return;

      med.times.forEach(time => {
        if (!isDoseTakenToday(med.id, time)) {
          allDoses.push({ med, time });
        }
      });
    });

    return allDoses.sort((a, b) => a.time.localeCompare(b.time))[0];
  };

  const getCompletedDoses = () => {
    const today = new Date().toLocaleDateString();
    const completed: { med: Medication, time: string }[] = [];
    
    medications.forEach(med => {
      if (!isMedicationScheduledForToday(med)) return;

      med.times.forEach(time => {
        if (isDoseTakenToday(med.id, time)) {
          completed.push({ med, time });
        }
      });
    });
    
    return completed.sort((a, b) => a.time.localeCompare(b.time));
  };

  const upcomingDose = getUpcomingDose();
  const completedDoses = getCompletedDoses();

  return (
    <div className="min-h-screen max-w-md mx-auto bg-[#0A0E14] pb-32 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full" />
      <div className="absolute bottom-[20%] left-[-10%] w-64 h-64 bg-gold/5 blur-[100px] rounded-full" />

      {/* Brand Header */}
      <div className="pt-8 text-center">
        <h3 className="text-2xl font-serif text-slate-300/80 tracking-wide">MediMinder Premium</h3>
      </div>

      {/* Due Dose Alert Modal */}
      <AnimatePresence>
        {dueDose && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => {
                setDueDose(null);
                stopAlarm();
              }}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-[#151B23] border border-gold/30 rounded-3xl p-8 shadow-2xl shadow-gold/10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold to-transparent" />
              
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center border border-gold/20">
                  <Bell className="w-10 h-10 text-gold animate-bounce" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-serif font-bold text-slate-100">Medication Reminder</h2>
                  <p className="text-slate-400">It's time to take your medication.</p>
                </div>

                <div className="w-full p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                  <h3 className="text-xl font-bold text-gold">{dueDose.med.name}</h3>
                  <div className="flex items-center justify-center gap-2 mt-1 text-slate-300">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono">{dueDose.time}</span>
                    {dueDose.med.instructions && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="text-sm italic">{dueDose.med.instructions}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col w-full gap-3">
                  <Button 
                    className="w-full bg-gold hover:bg-gold/90 text-black font-bold h-14 rounded-2xl text-lg"
                    onClick={() => {
                      logDose(dueDose.med.id, 'taken');
                      setDueDose(null);
                      stopAlarm();
                    }}
                  >
                    Mark as Taken
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full border-slate-700 hover:bg-slate-800 text-slate-300 h-14 rounded-2xl"
                    onClick={() => {
                      setDueDose(null);
                      stopAlarm();
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="p-8 pt-12 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif italic text-slate-400">Good Evening,</h2>
          <h1 className="text-3xl font-serif font-bold text-slate-100 flex items-center gap-2">
            Eleanor. <span className="text-xl">🌿</span>
          </h1>
        </div>
        <div className="w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center bg-slate-800/50">
          <User className="w-6 h-6 text-slate-300" />
        </div>
      </header>

      <main className="px-8 space-y-8">
        {activeTab === 'home' ? (
          <>
            {/* Today's Schedule Header */}
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-100">Today's Schedule</h2>
                <p className="text-slate-500 text-sm font-medium">
                  {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
              </div>

              {/* Completed Doses Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {completedDoses.map((dose, idx) => (
                  <Card key={`${dose.med.id}-${idx}`} className="p-4 bg-[#151B23]/80 relative overflow-hidden border-[#212830]">
                    <div className="absolute top-3 right-3">
                      <div className="w-4 h-4 rounded-full bg-gold/20 flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-gold" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-gold">{dose.time} AM</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Complete</p>
                      <p className="text-sm font-semibold text-slate-200 truncate">{dose.med.name}</p>
                      <p className="text-[10px] text-slate-500 font-medium">'{dose.time.split(':')[0]} AM'</p>
                    </div>
                  </Card>
                ))}
                
                {completedDoses.length === 0 && (
                  <div className="col-span-2 py-4 text-center text-slate-600 text-xs italic">
                    No doses completed yet today.
                  </div>
                )}
              </div>

              {/* Upcoming Dose Large Card */}
              {upcomingDose ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="bg-[#151B23] border-[#212830] p-6 relative">
                    <div className="flex justify-between items-start mb-6">
                      <h3 className="text-2xl font-bold text-gold">{upcomingDose.time} PM</h3>
                      <span className="text-[10px] font-bold text-gold bg-gold/10 px-3 py-1 rounded-full tracking-widest uppercase">Upcoming</span>
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                          <Pill className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-slate-100">Take Now</h4>
                        <p className="text-slate-300 font-medium">{upcomingDose.med.name}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                        <Utensils className="w-4 h-4" />
                        <span>{upcomingDose.med.instructions || 'Take as directed'}</span>
                      </div>

                      <div className="space-y-2">
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${((upcomingDose.med.takenPills || 0) / (upcomingDose.med.totalPills || 30)) * 100}%` }}
                            className="h-full bg-gold/60 rounded-full"
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                          Remaining: { (upcomingDose.med.totalPills || 30) - (upcomingDose.med.takenPills || 0) } pills
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => logDose(upcomingDose.med.id, 'taken')}
                      className="mt-6 w-full py-4 bg-gold text-black font-bold rounded-2xl active:scale-95 transition-all"
                    >
                      Mark as Taken
                    </button>
                  </Card>
                </motion.div>
              ) : (
                <div className="py-12 text-center bg-slate-900/40 rounded-3xl border border-dashed border-slate-800">
                  <p className="text-slate-500 font-medium">All doses for today are complete!</p>
                </div>
              )}
            </section>

            {/* Weekly Calendar */}
            <section>
              <div className="flex justify-between items-center no-scrollbar overflow-x-auto gap-2 pb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() - date.getDay() + i);
                  const isToday = date.toLocaleDateString() === new Date().toLocaleDateString();
                  return (
                    <div 
                      key={i} 
                      className={`flex flex-col items-center justify-center min-w-[48px] h-16 rounded-2xl transition-all ${
                        isToday ? 'bg-gold text-black' : 'bg-[#151B23] text-slate-400'
                      }`}
                    >
                      <span className="text-[10px] font-bold mb-1">{day}</span>
                      <span className="text-lg font-bold">{date.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : activeTab === 'medication' ? (
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-100">My Medications</h2>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="p-2 bg-gold/10 text-gold rounded-xl hover:bg-gold/20 transition-all"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {medications.map(med => (
                <Card key={med.id} className="bg-[#151B23] border-[#212830] p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${med.color}20` }}>
                      <Pill className="w-6 h-6" style={{ color: med.color }} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-100">{med.name}</h4>
                      <p className="text-xs text-slate-500 font-medium">
                        {med.frequency === 'daily' ? 'Every day' : med.frequency === 'weekly' ? 'Weekly' : 'As needed'} 
                        {med.times.length > 0 && ` • ${med.times.join(', ')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setEditingMedication(med)}
                      className="p-2 text-slate-400 hover:text-gold hover:bg-gold/10 rounded-xl transition-all"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => deleteMedication(med.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </Card>
              ))}

              {medications.length === 0 && (
                <div className="py-20 text-center bg-slate-900/40 rounded-3xl border border-dashed border-slate-800">
                  <p className="text-slate-500 italic">No medications added yet.</p>
                  <Button 
                    variant="outline" 
                    className="mt-4 mx-auto"
                    onClick={() => setIsAddModalOpen(true)}
                  >
                    Add Your First Medication
                  </Button>
                </div>
              )}
            </div>
          </section>
        ) : activeTab === 'settings' ? (
          <section className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-100">Settings</h2>
            
            <Card className="bg-[#151B23] border-[#212830] p-6 space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-200">Notifications & Sounds</h3>
                <p className="text-sm text-slate-500">Test your alarm sound and notification settings.</p>
              </div>

              <div className="space-y-4">
                <Button 
                  variant="outline" 
                  className="w-full h-14 rounded-2xl border-gold/20 text-gold hover:bg-gold/5"
                  onClick={() => {
                    playAlarm();
                    setTimeout(stopAlarm, 3000);
                  }}
                >
                  <Bell className="w-5 h-5" />
                  Test Alarm Sound (3s)
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full h-14 rounded-2xl"
                  onClick={() => {
                    if ("Notification" in window) {
                      Notification.requestPermission().then(permission => {
                        if (permission === "granted") {
                          new Notification("MedRemind Test", { body: "This is a test notification." });
                        }
                      });
                    }
                  }}
                >
                  <AlertCircle className="w-5 h-5" />
                  Test Notification
                </Button>
              </div>
            </Card>

            <Card className="bg-[#151B23] border-[#212830] p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Pill className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">Background Reminders</h4>
                  <p className="text-xs text-slate-500">Get alerts even when the app is closed.</p>
                </div>
              </div>
              <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  To receive notifications when the app is not open, please <span className="text-gold font-bold">"Add to Home Screen"</span> (Install) this app from your browser menu.
                </p>
                <div className="flex gap-2">
                  <div className="px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-300">1. Open Browser Menu</div>
                  <div className="px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-300">2. Add to Home Screen</div>
                </div>
              </div>
            </Card>

            <Card className="bg-[#151B23] border-[#212830] p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200">Clear All Data</h4>
                    <p className="text-xs text-slate-500">Reset all medications and logs</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="px-4 py-2 rounded-xl text-red-400 border-red-400/20 hover:bg-red-400/5 text-sm"
                  onClick={() => setIsResetConfirmOpen(true)}
                >
                  Reset
                </Button>
              </div>
            </Card>
          </section>
        ) : (
          <div className="py-20 text-center">
            <p className="text-slate-500 italic">This section is coming soon.</p>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0A0E14]/80 backdrop-blur-xl border-t border-slate-800/50 px-8 py-6 flex justify-between items-center z-40">
        <div onClick={() => setActiveTab('home')}>
          <NavItem icon={Home} label="Home" active={activeTab === 'home'} />
        </div>
        <div onClick={() => setActiveTab('medication')}>
          <NavItem icon={Pill} label="Medication" active={activeTab === 'medication'} />
        </div>
        <div onClick={() => setActiveTab('calendar')}>
          <NavItem icon={Calendar} label="Calendar" active={activeTab === 'calendar'} />
        </div>
        <div onClick={() => setActiveTab('insights')}>
          <NavItem icon={BarChart2} label="Insights" active={activeTab === 'insights'} />
        </div>
        <div onClick={() => setActiveTab('settings')}>
          <NavItem icon={Settings} label="Settings" active={activeTab === 'settings'} />
        </div>
      </nav>

      {/* Floating Add Button */}
      <button 
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-24 right-8 w-14 h-14 bg-gold text-black rounded-full shadow-2xl shadow-gold/20 flex items-center justify-center z-50 active:scale-90 transition-all"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Add Medication Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-[#151B23] rounded-t-[3rem] p-8 shadow-2xl border-t border-white/10"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-slate-100">New Medication</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-slate-800 rounded-full text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <AddMedicationForm onSubmit={addMedication} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Medication Modal */}
      <AnimatePresence>
        {editingMedication && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingMedication(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-[#151B23] rounded-t-[3rem] p-8 shadow-2xl border-t border-white/10"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-slate-100">Edit Medication</h2>
                <button onClick={() => setEditingMedication(null)} className="p-2 bg-slate-800 rounded-full text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <AddMedicationForm 
                initialData={editingMedication} 
                onSubmit={(med) => updateMedication({ ...med, id: editingMedication.id } as Medication)} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingMedicationId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setDeletingMedicationId(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-[#151B23] border border-red-500/30 rounded-3xl p-8 shadow-2xl"
            >
              <div className="text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-100">Delete Medication?</h3>
                  <p className="text-slate-400 text-sm">This action cannot be undone. All logs for this medication will also be removed.</p>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    className="flex-1 h-12 rounded-xl"
                    onClick={() => setDeletingMedicationId(null)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                    onClick={confirmDelete}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {isResetConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsResetConfirmOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-[#151B23] border border-red-500/30 rounded-3xl p-8 shadow-2xl"
            >
              <div className="text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-100">Clear All Data?</h3>
                  <p className="text-slate-400 text-sm">This will permanently delete all your medications and history. Are you absolutely sure?</p>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    className="flex-1 h-12 rounded-xl"
                    onClick={() => setIsResetConfirmOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                    onClick={confirmReset}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddMedicationForm({ onSubmit, initialData }: { onSubmit: (med: Omit<Medication, 'id'>) => void, initialData?: Medication }) {
  const [name, setName] = useState(initialData?.name || '');
  const [frequency, setFrequency] = useState<Medication['frequency']>(initialData?.frequency || 'daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(initialData?.daysOfWeek || [1, 2, 3, 4, 5]); // Default Mon-Fri
  const [times, setTimes] = useState<string[]>(initialData?.times || ['08:00']);
  const [instructions, setInstructions] = useState<Medication['instructions']>(initialData?.instructions || 'After Food');
  const [totalPills, setTotalPills] = useState(initialData?.totalPills || 30);

  const days = [
    { label: 'S', value: 0 },
    { label: 'M', value: 1 },
    { label: 'T', value: 2 },
    { label: 'W', value: 3 },
    { label: 'T', value: 4 },
    { label: 'F', value: 5 },
    { label: 'S', value: 6 },
  ];

  const toggleDay = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({
      name,
      frequency,
      daysOfWeek: frequency === 'weekly' ? daysOfWeek : undefined,
      times,
      startDate: new Date().toISOString(),
      color: '#EAB308',
      instructions,
      totalPills,
      takenPills: 0
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-8">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Medication Name</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Metformin"
            className="w-full px-5 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-100 focus:ring-2 focus:ring-gold/50 outline-none transition-all"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Frequency</label>
            <select 
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
              className="w-full px-5 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-100 focus:ring-2 focus:ring-gold/50 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="as-needed">As Needed</option>
            </select>
            <ChevronRight className="absolute right-4 top-[42px] w-4 h-4 text-slate-500 rotate-90 pointer-events-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Total Pills</label>
            <input 
              type="number" 
              value={totalPills}
              onChange={(e) => setTotalPills(parseInt(e.target.value))}
              className="w-full px-5 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-100 focus:ring-2 focus:ring-gold/50 outline-none transition-all"
            />
          </div>
        </div>

        {frequency === 'weekly' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-2"
          >
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Days</label>
            <div className="flex justify-between gap-1">
              {days.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                    daysOfWeek.includes(day.value) 
                      ? 'bg-gold text-black shadow-lg shadow-gold/20' 
                      : 'bg-slate-900/50 text-slate-500 border border-slate-800'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <div className="relative">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Instructions</label>
          <select 
            value={instructions}
            onChange={(e) => setInstructions(e.target.value as any)}
            className="w-full px-5 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-100 focus:ring-2 focus:ring-gold/50 outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="After Food">After Food</option>
            <option value="Before Food">Before Food</option>
            <option value="With Food">With Food</option>
            <option value="Empty Stomach">Empty Stomach</option>
          </select>
          <ChevronRight className="absolute right-4 top-[42px] w-4 h-4 text-slate-500 rotate-90 pointer-events-none" />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Reminder Times</label>
          <div className="flex flex-wrap gap-2">
            {times.map((time, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-slate-900/50 border border-slate-800 p-2 rounded-xl">
                <input 
                  type="time" 
                  value={time}
                  onChange={(e) => {
                    const newTimes = [...times];
                    newTimes[idx] = e.target.value;
                    setTimes(newTimes);
                  }}
                  className="bg-transparent text-slate-100 outline-none text-sm"
                />
                {times.length > 1 && (
                  <button type="button" onClick={() => setTimes(times.filter((_, i) => i !== idx))} className="text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button 
              type="button"
              onClick={() => setTimes([...times, '12:00'])}
              className="px-4 py-2 border border-dashed border-slate-700 rounded-xl text-slate-500 text-xs font-bold hover:text-gold hover:border-gold transition-all"
            >
              + Add Time
            </button>
          </div>
        </div>
      </div>

      <button 
        type="submit"
        className="w-full bg-gold text-black py-5 rounded-2xl font-bold shadow-xl shadow-gold/10 hover:bg-yellow-500 transition-all active:scale-95"
      >
        Save Medication
      </button>
    </form>
  );
}

