'use client';

import React, { useState, useEffect, useRef } from 'react';
import { type Video } from '@framevid/types';

interface ShareModalProps {
  video: any;
  isOpen: boolean;
  onClose: () => void;
  notifySuccess: (msg: string) => void;
}

const PRIVACY_OPTIONS = [
  {
    id: 'public',
    title: 'Public',
    description: 'Anyone on the internet can view',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
    )
  },
  {
    id: 'unlisted',
    title: 'Unlisted',
    description: 'Only people with the link can view',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
      </svg>
    )
  },
  {
    id: 'password',
    title: 'Password',
    description: 'Only people with the password can view',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>
      </svg>
    )
  }
];

export function ShareModal({ video, isOpen, onClose, notifySuccess }: ShareModalProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [privacy, setPrivacy] = useState(video?.settings?.privacy || 'public');
  const [password, setPassword] = useState(video?.settings?.password || '');
  const [downloadEnabled, setDownloadEnabled] = useState(video?.settings?.downloadEnabled || false);
  const [startAtChecked, setStartAtChecked] = useState(false);
  const [startAtTime, setStartAtTime] = useState('00:00');

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  if (!isOpen) return null;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://framevid.co';
  let shareUrl = `${baseUrl}/v/${video.id}`;
  
  if (startAtChecked && startAtTime) {
    const parts = startAtTime.split(':');
    let seconds = 0;
    if (parts.length === 2) {
      seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 3) {
      seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    } else {
      seconds = parseInt(startAtTime);
    }
    if (!isNaN(seconds)) {
      shareUrl += `?t=${seconds}`;
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    notifySuccess('Link copied to clipboard!');
  };

  const handleSave = async (newSettings: any) => {
    try {
      await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { ...video.settings, ...newSettings } }),
      });
    } catch (e) {
      console.error('Failed to save video settings', e);
    }
  };

  const onPrivacyChange = (id: string) => {
    setPrivacy(id);
    setDropdownOpen(false);
    handleSave({ privacy: id });
  };

  const onDownloadToggle = () => {
    const newVal = !downloadEnabled;
    setDownloadEnabled(newVal);
    handleSave({ downloadEnabled: newVal });
  };

  const onPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    handleSave({ password: val });
  };

  const currentOption = PRIVACY_OPTIONS.find(opt => opt.id === privacy) || PRIVACY_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl w-full max-w-[440px] shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <h3 className="text-xl font-bold tracking-tight text-[#1a1a1a]">Share</h3>
          <button onClick={onClose} className="text-[#1a1a1a] hover:bg-gray-100 p-2 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-2 space-y-7">
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[15px] font-bold text-[#1a1a1a]">Privacy</label>
            </div>
            
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`w-full flex items-center justify-between p-3.5 border rounded-xl text-left bg-white transition-all ${dropdownOpen ? 'border-gray-400 shadow-sm' : 'border-[#d3d4d5] hover:border-gray-400'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-[#1a1a1a] p-1">
                    {currentOption.icon}
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold text-[#1a1a1a] leading-tight mb-0.5">
                      {currentOption.title}
                    </div>
                    <div className="text-[14px] text-gray-500">
                      {currentOption.description}
                    </div>
                  </div>
                </div>
                <div className="text-[#1a1a1a] pr-1">
                  <svg className={`w-5 h-5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#e2e4e7] rounded-xl shadow-xl z-10 py-2 overflow-hidden">
                  {PRIVACY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => onPrivacyChange(opt.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f2f4f7] transition-colors text-left group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-[#1a1a1a] p-1">
                          {opt.icon}
                        </div>
                        <div>
                          <div className="text-[15px] font-semibold text-[#1a1a1a] leading-tight mb-0.5">
                            {opt.title}
                          </div>
                          <div className="text-[14px] text-gray-500">
                            {opt.description}
                          </div>
                        </div>
                      </div>
                      {privacy === opt.id && (
                        <div className="text-[#1a1a1a] pr-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {privacy === 'password' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200 mt-3">
                <input
                  type="text"
                  value={password}
                  onChange={onPasswordChange}
                  placeholder="Enter password"
                  className="w-full border border-[#d3d4d5] rounded-xl px-4 py-3 text-[14px] text-[#1a1a1a] focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all"
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <label className="text-[15px] font-bold text-[#1a1a1a]">Viewer permissions</label>
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-[#1a1a1a]">Downloads</span>
              <button 
                onClick={onDownloadToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${downloadEnabled ? 'bg-[#9881ff]' : 'bg-[#d3d4d5]'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${downloadEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[15px] font-bold text-[#1a1a1a]">Link</label>
            <div className="relative flex items-center">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full border border-[#d3d4d5] rounded-xl px-4 py-3 text-[15px] text-[#1a1a1a] bg-white outline-none"
              />
            </div>

            <button 
              onClick={handleCopy}
              className="w-full bg-[#1a1a1a] hover:bg-black text-white font-bold py-3.5 rounded-xl text-[16px] transition-colors"
            >
              Copy link
            </button>


          </div>

        </div>



      </div>
    </div>
  );
}
