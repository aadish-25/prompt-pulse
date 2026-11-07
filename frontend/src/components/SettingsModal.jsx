import React, { useState, useEffect } from 'react';
import { X, Key, Shield, User, Check, AlertCircle, Loader2 } from 'lucide-react';
import { getByokKeys, saveByokKeys, apiLogin, apiDemoLogin, apiGetMe, getAuthToken, setAuthToken } from '../api/client';

export default function SettingsModal({ isOpen, onClose, onAuthChange, onKeysUpdated }) {
  const [activeTab, setActiveTab] = useState('byok'); // 'byok' | 'auth'
  
  // BYOK state
  const [keys, setKeys] = useState({
    openrouter: '',
    groq: '',
    deepseek: '',
    tavily: '',
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Auth state
  const [currentUser, setCurrentUser] = useState(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const stored = getByokKeys();
      setKeys({
        openrouter: stored.openrouter || '',
        groq: stored.groq || '',
        deepseek: stored.deepseek || '',
        tavily: stored.tavily || '',
      });
      loadUser();
    }
  }, [isOpen]);

  const loadUser = async () => {
    const user = await apiGetMe();
    setCurrentUser(user);
  };

  if (!isOpen) return null;

  const handleSaveKeys = (e) => {
    e.preventDefault();
    saveByokKeys(keys);
    setSavedSuccess(true);
    if (onKeysUpdated) onKeysUpdated(keys);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await apiLogin(username, password);
      setCurrentUser(res.user);
      setPassword('');
      if (onAuthChange) onAuthChange(res.user);
    } catch (err) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await apiDemoLogin();
      setCurrentUser(res.user);
      if (onAuthChange) onAuthChange(res.user);
    } catch (err) {
      setAuthError(err.message || 'Demo session failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken('');
    setCurrentUser(null);
    if (onAuthChange) onAuthChange(null);
  };

  const hasAnyByok = Boolean(keys.openrouter || keys.groq || keys.deepseek || keys.tavily);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-surface-850 border border-surface-border rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Platform Settings & Keys</h3>
              <p className="text-xs text-slate-400">Bring Your Own Key (BYOK) & Authentication</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-surface-border text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('byok')}
            className={`flex items-center gap-1.5 pb-2 px-3 font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'byok'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys (BYOK)</span>
            {hasAnyByok && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('auth')}
            className={`flex items-center gap-1.5 pb-2 px-3 font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'auth'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Account & Auth</span>
            {currentUser?.is_admin && <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 ml-1">Admin</span>}
          </button>
        </div>

        {/* BYOK Tab */}
        {activeTab === 'byok' && (
          <form onSubmit={handleSaveKeys} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-surface-900 border border-surface-border space-y-1">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span>Bring Your Own Key Priority</span>
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                If provided, your personal API keys are used directly for LLM generation and Tavily searches.
                If empty, the system gracefully falls back to our server keys (up to 5 free trial prompts for guests).
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 flex justify-between">
                  <span>OpenRouter API Key</span>
                  <span className="text-[10px] text-slate-500">gpt-4o, gemini, llama</span>
                </label>
                <input
                  type="password"
                  value={keys.openrouter}
                  onChange={(e) => setKeys({ ...keys, openrouter: e.target.value })}
                  placeholder="sk-or-v1-..."
                  className="w-full bg-surface-900 border border-surface-border rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 flex justify-between">
                  <span>Groq API Key</span>
                  <span className="text-[10px] text-slate-500">Ultra-fast LPU inference</span>
                </label>
                <input
                  type="password"
                  value={keys.groq}
                  onChange={(e) => setKeys({ ...keys, groq: e.target.value })}
                  placeholder="gsk_..."
                  className="w-full bg-surface-900 border border-surface-border rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 flex justify-between">
                  <span>DeepSeek API Key</span>
                  <span className="text-[10px] text-slate-500">deepseek-chat, deepseek-reasoner</span>
                </label>
                <input
                  type="password"
                  value={keys.deepseek}
                  onChange={(e) => setKeys({ ...keys, deepseek: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-surface-900 border border-surface-border rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 flex justify-between">
                  <span>Tavily Search API Key</span>
                  <span className="text-[10px] text-slate-500">Live web grounding & citations</span>
                </label>
                <input
                  type="password"
                  value={keys.tavily}
                  onChange={(e) => setKeys({ ...keys, tavily: e.target.value })}
                  placeholder="tvly-..."
                  className="w-full bg-surface-900 border border-surface-border rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {savedSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1.5 animate-fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>API Keys saved securely to this browser session!</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-border">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save API Keys</span>
              </button>
            </div>
          </form>
        )}

        {/* Auth Tab */}
        {activeTab === 'auth' && (
          <div className="space-y-4 text-xs">
            {currentUser?.is_admin ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-amber-300">Logged in as Administrator</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-2.5 py-1 text-[11px] bg-surface-800 hover:bg-surface-700 text-slate-300 rounded border border-surface-border cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
                <p className="text-[11px] text-slate-300">
                  Unlimited server keys & runs active. Free-tier prompt limits are bypassed.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-surface-900 border border-surface-border flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200">Current Session: Demo Reviewer</span>
                    <p className="text-[11px] text-slate-400">Includes 5 free test prompts via our server key.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={authLoading}
                    className="px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 border border-surface-border text-slate-200 font-semibold cursor-pointer"
                  >
                    Refresh Demo
                  </button>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-3 p-3.5 rounded-xl bg-surface-900 border border-surface-border">
                  <span className="font-semibold text-slate-200 block">Sign In as Admin</span>

                  {authError && (
                    <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Admin Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-surface-850 border border-surface-border rounded px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Admin Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="PromptPulse@2026!Admin#Secure"
                      className="w-full bg-surface-850 border border-surface-border rounded px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading || !password}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {authLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Authenticate as Admin</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
