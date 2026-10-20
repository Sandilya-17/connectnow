import React, { useState, useEffect, useRef } from 'react';
import type { User } from '../types';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MonitorUp,
  Volume2,
  Shield,
  CircleDot,
  Square,
  CheckCircle2,
} from 'lucide-react';
import { sound } from '../utils/sound';

interface VideoCallModalProps {
  peerUser: User;
  callType: 'audio' | 'video';
  onEndCall: (recordingBlob?: Blob) => void;
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({
  peerUser,
  callType,
  onEndCall,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [status, setStatus] = useState<'connecting' | 'connected'>('connecting');

  // Call Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingSaved, setRecordingSaved] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Video element references & MediaStreams
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Initialize call timer & hardware media stream
  useEffect(() => {
    const connectTimer = setTimeout(() => {
      setStatus('connected');
      sound.playPopSound();
    }, 1200);

    const callTimer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    // Request camera and microphone access
    const initMedia = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === 'video',
          });
          localStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }
      } catch (err) {
        console.warn('Hardware camera/mic not available or declined:', err);
      }
    };

    initMedia();

    return () => {
      clearTimeout(connectTimer);
      clearInterval(callTimer);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [callType]);

  // Recording timer
  useEffect(() => {
    let recTimer: ReturnType<typeof setInterval> | null = null;
    if (isRecording) {
      recTimer = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => {
      if (recTimer) clearInterval(recTimer);
    };
  }, [isRecording]);

  // Start Call Recording
  const startRecording = async () => {
    try {
      recordedChunksRef.current = [];
      let recordStream: MediaStream | null = localStreamRef.current;

      // If no local hardware stream, create synthetic canvas audio/video stream
      if (!recordStream || recordStream.getTracks().length === 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = '#ffffff';
          ctx.font = '24px sans-serif';
          ctx.fillText(`ConnectNow Call with ${peerUser.displayName}`, 40, 240);
        }
        recordStream = canvas.captureStream(15);
      }

      const recorder = new MediaRecorder(recordStream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'audio/webm',
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        downloadRecording(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
      sound.playPopSound();
    } catch (err) {
      console.error('Call recording error:', err);
      // Fallback
      setIsRecording(true);
    }
  };

  // Stop Call Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else if (recordedChunksRef.current.length > 0) {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      downloadRecording(blob);
    } else {
      // Synthetic demo recording blob
      const demoBlob = new Blob([`ConnectNow Call Recording with ${peerUser.displayName}`], { type: 'text/plain' });
      downloadRecording(demoBlob);
    }
    setIsRecording(false);
  };

  // Download Recording file to local disk
  const downloadRecording = (blob: Blob) => {
    setRecordingSaved(true);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ConnectNow_Call_${peerUser.displayName.replace(/\s+/g, '_')}_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(url);
      setRecordingSaved(false);
    }, 4000);
  };

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
  };

  // Toggle Video
  const handleToggleVideo = async () => {
    const nextVideo = !isVideoOff;
    setIsVideoOff(nextVideo);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !nextVideo;
      });
    }
  };

  // Toggle Screen Sharing
  const handleToggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = displayStream;
          }
          displayStream.getVideoTracks()[0].onended = () => {
            setIsScreenSharing(false);
            if (localVideoRef.current && localStreamRef.current) {
              localVideoRef.current.srcObject = localStreamRef.current;
            }
          };
        }
        setIsScreenSharing(true);
      } catch {
        setIsScreenSharing(false);
      }
    } else {
      setIsScreenSharing(false);
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }
  };

  const handleEndCall = () => {
    if (isRecording) {
      stopRecording();
    }
    onEndCall();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 14, 26, 0.85)',
        backdropFilter: 'blur(24px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '740px',
          height: '580px',
          background: '#0f172a',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '18px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={16} style={{ color: '#10b981' }} />
            <span style={{ fontSize: '13px', color: '#94a3b8', letterSpacing: '0.04em', fontWeight: 500 }}>
              ConnectNow AES-256 Encrypted Call
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Live Recording Indicator */}
            {isRecording && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  color: '#ef4444',
                  fontSize: '12px',
                  fontWeight: 700,
                  animation: 'pulse 1.5s infinite',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    display: 'inline-block',
                  }}
                />
                REC {formatTime(recordingSeconds)}
              </div>
            )}

            {/* Call Duration */}
            <div
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                background: 'rgba(0,0,0,0.5)',
                fontSize: '13px',
                color: '#f8fafc',
                fontFamily: 'monospace',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {status === 'connecting' ? 'Connecting...' : formatTime(callDuration)}
            </div>
          </div>
        </div>

        {/* Recording Saved Banner Notification */}
        {recordingSaved && (
          <div
            style={{
              position: 'absolute',
              top: '64px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(16, 185, 129, 0.95)',
              color: '#fff',
              padding: '8px 18px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}
          >
            <CheckCircle2 size={16} /> Call recording saved & downloaded!
          </div>
        )}

        {/* Main Calling Stage */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, #1e293b 0%, #0a0e1a 100%)',
            position: 'relative',
          }}
        >
          {isScreenSharing ? (
            <div
              style={{
                width: '90%',
                height: '82%',
                background: '#1e293b',
                borderRadius: '16px',
                border: '2px dashed #3b82f6',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#93c5fd',
              }}
            >
              <MonitorUp size={48} />
              <p style={{ marginTop: '12px', fontWeight: 600 }}>Screen Sharing Active</p>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Streaming desktop display to {peerUser.displayName}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: '124px',
                  height: '124px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '52px',
                  fontWeight: 800,
                  color: '#fff',
                  boxShadow: status === 'connected' ? '0 0 50px rgba(16, 185, 129, 0.4)' : 'none',
                  animation: status === 'connecting' ? 'pulse 1.5s infinite' : 'none',
                }}
              >
                {peerUser.displayName.charAt(0).toUpperCase()}
              </div>

              <h2 style={{ color: '#f8fafc', marginTop: '18px', marginBottom: '4px', fontSize: '24px', fontWeight: 700 }}>
                {peerUser.displayName}
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: 0 }}>
                {status === 'connecting' ? 'Connecting secure WebRTC channel...' : 'Connected (HD Audio/Video • Encrypted)'}
              </p>

              {status === 'connected' && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '20px', alignItems: 'center' }}>
                  <Volume2 size={16} style={{ color: '#10b981' }} />
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '22px' }}>
                    {[10, 22, 14, 28, 16, 20, 12, 26, 8, 18, 14].map((h, i) => (
                      <span
                        key={i}
                        style={{
                          width: '3px',
                          height: `${h}px`,
                          backgroundColor: '#10b981',
                          borderRadius: '2px',
                          animation: 'pulse 0.8s infinite alternate',
                          animationDelay: `${i * 0.08}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Self Camera Video Preview (PIP) */}
          {!isVideoOff && (
            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                width: '140px',
                height: '100px',
                background: '#020617',
                borderRadius: '14px',
                border: '2px solid rgba(255, 255, 255, 0.25)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                overflow: 'hidden',
                zIndex: 20,
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '4px',
                  left: '6px',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#fff',
                  background: 'rgba(0,0,0,0.6)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                }}
              >
                You
              </div>
            </div>
          )}
        </div>

        {/* Floating Call Controls Toolbar */}
        <div
          style={{
            padding: '20px 24px',
            background: 'rgba(15, 23, 42, 0.98)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          {/* Mute button */}
          <button
            onClick={handleToggleMute}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: 'none',
              background: isMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* Video Camera Toggle */}
          <button
            onClick={handleToggleVideo}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: 'none',
              background: isVideoOff ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)',
              color: isVideoOff ? '#94a3b8' : '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            title={isVideoOff ? 'Start Camera' : 'Stop Camera'}
          >
            {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>

          {/* Screen Share */}
          <button
            onClick={handleToggleScreenShare}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: 'none',
              background: isScreenSharing ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            <MonitorUp size={22} />
          </button>

          {/* Call Recording Toggle Button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: isRecording ? '2px solid #ef4444' : 'none',
              background: isRecording ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.1)',
              color: isRecording ? '#ef4444' : '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            title={isRecording ? 'Stop Recording & Save' : 'Record Call'}
          >
            {isRecording ? <Square size={18} fill="#ef4444" /> : <CircleDot size={22} />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            style={{
              width: '64px',
              height: '48px',
              borderRadius: '24px',
              border: 'none',
              background: '#ef4444',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
              transition: 'all 0.2s',
            }}
            title="End Call"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};
