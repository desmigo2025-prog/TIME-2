import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Lecture, LectureNote } from '../types';
import { useAuth } from './AuthContext';
import { set, get, del } from 'idb-keyval';

interface LectureContextType {
  lectures: Lecture[];
  addLecture: (lecture: Lecture, audioBlob?: Blob) => void;
  updateLecture: (id: string, updates: Partial<Lecture>) => void;
  deleteLecture: (id: string) => void;
  addNoteToLecture: (lectureId: string, note: LectureNote) => void;
  updateNote: (lectureId: string, noteId: string, content: string) => void;
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

const LectureContext = createContext<LectureContextType | undefined>(undefined);

export const LectureProvider = ({ children }: { children?: ReactNode }) => {
  const { user } = useAuth();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimeRef = useRef(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    recordingTimeRef.current = recordingTime;
  }, [recordingTime]);

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, isPaused]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        } 
      });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const newLecture: Lecture = {
          id: Math.random().toString(36).substr(2, 9),
          title: 'Recorded Lecture',
          date: new Date().toISOString(),
          durationSeconds: recordingTimeRef.current,
          status: 'processing',
          notes: []
        };
        addLecture(newLecture, audioBlob);
        // Dispatch an event so Lectures.tsx can process it
        window.dispatchEvent(new CustomEvent('lectureRecorded', { detail: { blob: audioBlob, lectureId: newLecture.id } }));
      };

      recorder.start(1000); // collect chunks every second
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
    } catch (err) {
      alert("Microphone access denied or unavailable.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setIsPaused(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setIsPaused(false);
      setMediaRecorder(null);
    }
  };

  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`tt_lectures_${user.id}`);
      if (stored) {
        const parsedLectures: Lecture[] = JSON.parse(stored);
        
        // Rehydrate audio URLs from IndexedDB
        const rehydrateAudio = async () => {
          const updatedLectures = await Promise.all(parsedLectures.map(async (lecture) => {
            try {
              const blob = await get(`audio_${lecture.id}`);
              if (blob instanceof Blob) {
                return { ...lecture, audioUrl: URL.createObjectURL(blob) };
              }
            } catch (e) {
              console.error("Failed to load audio for lecture", lecture.id);
            }
            return lecture;
          }));
          setLectures(updatedLectures);
        };
        
        rehydrateAudio();
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && lectures.length > 0) {
      // Don't save the blob URLs to localStorage, they are temporary
      const lecturesToSave = lectures.map(l => ({ ...l, audioUrl: undefined }));
      localStorage.setItem(`tt_lectures_${user.id}`, JSON.stringify(lecturesToSave));
    } else if (user && lectures.length === 0) {
      localStorage.removeItem(`tt_lectures_${user.id}`);
    }
  }, [lectures, user]);

  const addLecture = async (lecture: Lecture, audioBlob?: Blob) => {
    if (audioBlob) {
      await set(`audio_${lecture.id}`, audioBlob);
      lecture.audioUrl = URL.createObjectURL(audioBlob);
    }
    setLectures(prev => [lecture, ...prev]);
  };

  const updateLecture = (id: string, updates: Partial<Lecture>) => {
    setLectures(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const deleteLecture = async (id: string) => {
    await del(`audio_${id}`);
    setLectures(prev => prev.filter(l => l.id !== id));
  };

  const addNoteToLecture = (lectureId: string, note: LectureNote) => {
    setLectures(prev => prev.map(l => {
      if (l.id === lectureId) {
        return { ...l, notes: [note, ...l.notes] };
      }
      return l;
    }));
  };

  const updateNote = (lectureId: string, noteId: string, content: string) => {
    setLectures(prev => prev.map(l => {
      if (l.id === lectureId) {
        return {
          ...l,
          notes: l.notes.map(n => n.id === noteId ? { ...n, content } : n)
        };
      }
      return l;
    }));
  };

  return (
    <LectureContext.Provider value={{ 
      lectures, addLecture, updateLecture, deleteLecture, addNoteToLecture, updateNote,
      isRecording, isPaused, recordingTime, startRecording, stopRecording, pauseRecording, resumeRecording
    }}>
      {children}
    </LectureContext.Provider>
  );
};

export const useLectures = () => {
  const context = useContext(LectureContext);
  if (!context) throw new Error('useLectures must be used within a LectureProvider');
  return context;
};
