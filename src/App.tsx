import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { MessageSquare, Calendar, Mail, FileText, Settings, Shield, Bell, Moon, Sun, Camera, Video, Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Utility
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Configs
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/calendar');

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode as requested
  const [activeTab, setActiveTab] = useState('chat');
  
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      // In production, we'd manage token refresh more robustly
      if (!u) setToken(null);
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setToken(credential.accessToken);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    auth.signOut();
  };

  if (!user || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white transition-colors">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-6">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Archeus</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">Personal Productivity Agent for Google Calendar and Gmail.</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white transition-colors flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </div>
            Archeus
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<MessageSquare />} label="Chat" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
          <NavItem icon={<FileText />} label="Audit Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
          <NavItem icon={<Shield />} label="Security" />
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <img src={user.photoURL || ''} alt="avatar" className="w-10 h-10 rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.displayName}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full">
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center px-6 justify-between bg-white/50 dark:bg-slate-950/50 backdrop-blur-md">
          <h2 className="font-semibold text-lg">{activeTab === 'chat' ? 'Workspace Assistant' : 'Audit Logs'}</h2>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <button onClick={handleLogout} className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white">Sign out</button>
          </div>
        </header>

        {activeTab === 'chat' ? <ChatInterface token={token} /> : <AuditLogs />}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
      active 
        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" 
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
    )}>
      <span className="w-4 h-4 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full">{icon}</span>
      {label}
    </button>
  );
}

function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Audit Logs & Actions</h2>
          <p className="text-slate-500">Comprehensive audit log for monitoring all system activity, changes, and manual overrides.</p>
        </div>

        <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                    {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Just now'}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{log.model || 'System'}</td>
                  <td className="px-4 py-3 truncate max-w-xs">{log.responseText || 'No details'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ChatInterface({ token }: { token: string }) {
  const [messages, setMessages] = useState<{role: string, content: string | any[]}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useHighThinking, setUseHighThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMsgs = [...messages, { role: 'user', content: input }];
    setMessages(newMsgs);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ messages: newMsgs, thinking: useHighThinking })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Update with server resolved messages (which includes function calls)
      // For UI simplicity, just append the final text response.
      setMessages([...newMsgs, { role: 'model', content: data.text }]);
    } catch (e: any) {
      console.error(e);
      setMessages([...newMsgs, { role: 'model', content: `Error: ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/50 relative">
      <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4 max-w-md">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold">How can I help you today?</h3>
              <p className="text-slate-500 dark:text-slate-400">
                I can check your Gmail, draft replies, and manage your Google Calendar events.
              </p>
            </div>
          </div>
        )}
        
        {messages.filter(m => typeof m.content === 'string').map((m, i) => (
          <div key={i} className={cn("flex max-w-3xl", m.role === 'user' ? "ml-auto justify-end" : "mr-auto")}>
            <div className={cn(
              "px-5 py-3 rounded-2xl",
              m.role === 'user' 
                ? "bg-blue-600 text-white rounded-br-sm" 
                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-bl-sm"
            )}>
              {m.role === 'model' ? (
                <div className="markdown-body prose prose-slate dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown>{m.content as string}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex max-w-3xl mr-auto">
             <div className="px-5 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-bl-sm">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
             </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-2 px-2">
             <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
               <input type="checkbox" checked={useHighThinking} onChange={e => setUseHighThinking(e.target.checked)} className="rounded border-slate-300" />
               Enable High Thinking (Gemini Pro)
             </label>
          </div>
          <div className="relative flex items-end gap-2 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-2 focus-within:ring-2 ring-blue-500/50 transition-all">
            <button className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-colors">
              <Camera className="w-5 h-5" />
            </button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Archeus to check your calendar or email..."
              className="flex-1 max-h-32 min-h-[44px] bg-transparent border-0 focus:ring-0 resize-none py-3 text-sm placeholder:text-slate-400"
              rows={1}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
