import React, { useState, useRef, useEffect } from 'react';
import { useLectures } from '../contexts/LectureContext';
import { useUsage } from '../contexts/UsageContext';
import { useAuth } from '../contexts/AuthContext';
import { generateLectureNotes } from '../services/geminiService';
import { Mic, Square, Play, Pause, Upload, Loader, FileText, Download, Edit, Trash2, Crown, CheckCircle, PlusCircle, Share2, Save, X } from 'lucide-react';
import { Lecture, LectureNote, NoteFormat } from '../types';
import Markdown from 'react-markdown';
import { useTasks } from '../contexts/TaskContext';
import StudyMaterialGenerator from '../components/StudyMaterialGenerator';

const Lectures = () => {
  const { lectures, addLecture, updateLecture, deleteLecture, addNoteToLecture, updateNote, isRecording, isPaused, recordingTime, startRecording, stopRecording, pauseRecording, resumeRecording } = useLectures();
  const { isPro } = useUsage();
  const { addTask } = useTasks();
  const { user } = useAuth();

  const theme = user?.aiSettings?.theme || 'dark';
  
  // Helper to determine if custom color is light
  const isCustomLight = () => {
      if (theme !== 'custom' || !user?.aiSettings?.customThemeColor) return false;
      const hex = user.aiSettings.customThemeColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return brightness > 155;
  };

  const isLightTheme = theme === 'nature' || theme === 'ocean' || theme === 'sunset' || theme === 'ladies' || theme === 'white' || isCustomLight();

  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<NoteFormat>('full');
  const [removeFillerWords, setRemoveFillerWords] = useState(false);
  const [activeLectureId, setActiveLectureId] = useState<string | null>(null);
  
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pro limit: 15 mins (900 seconds)
  const MAX_FREE_DURATION = 900; 

  useEffect(() => {
    if (isRecording && !isPaused && !isPro && recordingTime >= MAX_FREE_DURATION) {
      stopRecording();
    }
  }, [recordingTime, isRecording, isPaused, isPro, stopRecording]);

  useEffect(() => {
    const handleLectureRecorded = (e: any) => {
      const { blob, lectureId } = e.detail;
      handleAudioReady(blob, 'Recorded Lecture', recordingTime, lectureId);
    };
    const handleAiStartRecording = () => {
      if (!isRecording) startRecording();
    };
    const handleAiStopRecording = () => {
      if (isRecording) stopRecording();
    };
    
    window.addEventListener('lectureRecorded', handleLectureRecorded);
    window.addEventListener('aiStartRecording', handleAiStartRecording);
    window.addEventListener('aiStopRecording', handleAiStopRecording);
    
    return () => {
      window.removeEventListener('lectureRecorded', handleLectureRecorded);
      window.removeEventListener('aiStartRecording', handleAiStartRecording);
      window.removeEventListener('aiStopRecording', handleAiStopRecording);
    };
  }, [recordingTime, isRecording, startRecording, stopRecording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProcessing) return;
    const file = e.target.files?.[0];
    if (file) {
      handleAudioReady(file, file.name, 0);
    }
  };

  const handleAudioReady = async (blob: Blob, title: string, duration: number, existingId?: string) => {
    let lectureId = existingId;
    if (!lectureId) {
      const newLecture: Lecture = {
        id: Math.random().toString(36).substr(2, 9),
        title: title,
        date: new Date().toISOString(),
        durationSeconds: duration,
        status: 'processing',
        notes: []
      };
      addLecture(newLecture, blob);
      lectureId = newLecture.id;
    }
    
    // Process AI
    if (lectureId) {
      processAudio(blob, lectureId, selectedFormat);
    }
  };

  const processAudio = async (blob: Blob, lectureId: string, format: NoteFormat) => {
    setIsProcessing(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        const mimeType = blob.type || 'audio/webm';
        
        try {
          const result = await generateLectureNotes(base64data, mimeType, format, removeFillerWords);
          
          updateLecture(lectureId, {
            rawTranscript: result.rawTranscript,
            cleanTranscript: result.cleanTranscript,
            status: 'completed'
          });

          addNoteToLecture(lectureId, {
            id: Math.random().toString(36).substr(2, 9),
            lectureId,
            format,
            content: result.notes,
            createdAt: new Date().toISOString()
          });

        } catch (err) {
          updateLecture(lectureId, { status: 'error' });
          alert("Could not generate notes. Try again.");
        } finally {
          setIsProcessing(false);
        }
      };
    } catch (err) {
      updateLecture(lectureId, { status: 'error' });
      alert("Unable to process recording.");
      setIsProcessing(false);
    }
  };

  const downloadNotes = (content: string, title: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = `${title}_notes.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const shareNotes = async (content: string, title: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${title} Notes`,
          text: content,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(content);
      alert("Notes copied to clipboard!");
    }
  };

  const handleEditSave = (lectureId: string, noteId: string) => {
    updateNote(lectureId, noteId, editContent);
    setEditingNoteId(null);
  };

  const addToTasks = (lectureTitle: string, noteContent: string) => {
    addTask({
      title: `Review: ${lectureTitle}`,
      day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      time: '18:00',
      durationMinutes: 60,
      venue: 'Study Room',
      description: `Review lecture notes:\n\n${noteContent.substring(0, 200)}...`,
      priority: 'MEDIUM' as any,
      status: 'PENDING' as any,
      category: 'School'
    });
    alert("Added to tasks!");
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Lecture Recorder
          {isPro && <Crown size={20} className="text-yellow-500" />}
        </h1>
      </div>

      {/* Recorder Section */}
      <div className={`glass-panel p-6 rounded-2xl border text-center space-y-4 ${isLightTheme ? 'border-gray-200 bg-white/80' : 'border-gray-700/50'}`}>
        <div className="flex justify-center items-center gap-4">
          {!isRecording ? (
            <button 
              onClick={startRecording}
              className="w-20 h-20 rounded-full bg-tt-red/20 text-tt-red flex items-center justify-center hover:bg-tt-red/30 transition-colors border-2 border-tt-red shadow-lg shadow-tt-red/20"
            >
              <Mic size={32} />
            </button>
          ) : (
            <>
              <button 
                onClick={isPaused ? resumeRecording : pauseRecording}
                className="w-16 h-16 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center hover:bg-yellow-500/30 transition-colors border-2 border-yellow-500"
              >
                {isPaused ? <Play size={24} /> : <Pause size={24} />}
              </button>
              <button 
                onClick={stopRecording}
                className="w-20 h-20 rounded-full bg-tt-red text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg shadow-tt-red/40"
              >
                <Square size={32} className="fill-current" />
              </button>
            </>
          )}
        </div>

        {isRecording && (
          <div className="text-3xl font-mono font-bold text-tt-red animate-pulse">
            {formatTime(recordingTime)}
          </div>
        )}

        {!isPro && isRecording && (
          <p className="text-xs opacity-60">Free limit: 15:00</p>
        )}

        <div className={`pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 ${isLightTheme ? 'border-gray-200' : 'border-gray-700/50'}`}>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`text-sm ${isLightTheme ? 'text-gray-600' : 'opacity-70'}`}>Output Format:</span>
              <select 
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as NoteFormat)}
                className={`border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-tt-blue ${isLightTheme ? 'bg-white border-gray-300 text-gray-900' : 'bg-black/20 border-gray-700 text-white'}`}
              >
                <option value="full">Full Notes</option>
                <option value="summary">Summary</option>
                <option value="key_points">Key Points</option>
                <option value="keywords">Keywords</option>
                <option value="raw_transcript">Raw Transcript</option>
                <option value="clean_transcript">Clean Transcript</option>
              </select>
            </div>
            
            <div className={`flex p-1 rounded-lg ${isLightTheme ? 'bg-gray-200' : 'bg-black/20'}`}>
              <button
                onClick={() => setRemoveFillerWords(false)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${!removeFillerWords ? 'bg-tt-blue text-white shadow-sm' : isLightTheme ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
              >
                RAW TRANSCRIPT
              </button>
              <button
                onClick={() => setRemoveFillerWords(true)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${removeFillerWords ? 'bg-tt-blue text-white shadow-sm' : isLightTheme ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
              >
                CLEAN MODE
              </button>
            </div>
          </div>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition-colors ${isLightTheme ? 'bg-gray-200 hover:bg-gray-300 text-gray-800' : 'bg-black/20 hover:bg-black/30 text-white'}`}
          >
            <Upload size={16} /> Upload Audio File
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="audio/*"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="bg-tt-blue/10 border border-tt-blue/30 rounded-xl p-4 flex items-center gap-3 text-tt-blue">
          <Loader className="animate-spin" size={20} />
          <span className="font-medium">Transcribing and generating notes...</span>
        </div>
      )}

      {/* Lectures List */}
      <div className="space-y-4">
        <h2 className="font-bold text-lg">Saved Lectures</h2>
        
        {lectures.length === 0 ? (
          <div className={`text-center py-10 opacity-50 border-2 border-dashed rounded-xl ${isLightTheme ? 'border-gray-300' : 'border-gray-700/50'}`}>
            <Mic size={48} className="mx-auto mb-3 opacity-20" />
            <p>No lectures recorded yet.</p>
          </div>
        ) : (
          lectures.map(lecture => (
            <div key={lecture.id} className={`glass-panel rounded-xl border overflow-hidden ${isLightTheme ? 'border-gray-200 bg-white/80' : 'border-gray-700/50'}`}>
              <div 
                className={`p-4 flex items-center justify-between cursor-pointer ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-black/5'}`}
                onClick={() => setActiveLectureId(activeLectureId === lecture.id ? null : lecture.id)}
              >
                <div>
                  <h3 className="font-bold text-current">{lecture.title}</h3>
                  <p className={`text-xs ${isLightTheme ? 'text-gray-500' : 'opacity-60'}`}>
                    {new Date(lecture.date).toLocaleDateString()} • {formatTime(lecture.durationSeconds)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {lecture.status === 'processing' && <Loader size={16} className="animate-spin text-tt-blue" />}
                  {lecture.status === 'completed' && <CheckCircle size={16} className="text-tt-green" />}
                  {lecture.status === 'error' && <span className="text-xs text-tt-red">Failed</span>}
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteLecture(lecture.id); }}
                    className="p-2 text-gray-500 hover:text-tt-red transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {activeLectureId === lecture.id && (
                <div className={`p-4 border-t space-y-4 ${isLightTheme ? 'border-gray-200 bg-gray-50' : 'border-gray-700/50 bg-black/10'}`}>
                  {lecture.audioUrl && (
                    <audio controls src={lecture.audioUrl} className="w-full h-10" />
                  )}
                  
                  {lecture.rawTranscript && (
                    <div className={`p-4 rounded-xl ${isLightTheme ? 'bg-white border border-gray-200' : 'bg-white/5'}`}>
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${isLightTheme ? 'bg-gray-200 text-gray-700' : 'opacity-70 bg-black/20'}`}>
                          RAW TRANSCRIPT
                        </span>
                        <button 
                          onClick={() => downloadNotes(lecture.rawTranscript!, `${lecture.title}_raw`)}
                          className={`p-1.5 rounded text-current transition-colors ${isLightTheme ? 'bg-gray-200 hover:bg-gray-300' : 'bg-black/20 hover:bg-black/30'}`}
                          title="Download Raw Transcript"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                      <div className={`text-sm max-h-60 overflow-y-auto whitespace-pre-wrap ${isLightTheme ? 'text-gray-800' : 'opacity-90'}`}>
                        {lecture.rawTranscript}
                      </div>
                    </div>
                  )}

                  {lecture.cleanTranscript && (
                    <div className={`p-4 rounded-xl ${isLightTheme ? 'bg-white border border-gray-200' : 'bg-white/5'}`}>
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${isLightTheme ? 'bg-gray-200 text-gray-700' : 'opacity-70 bg-black/20'}`}>
                          CLEAN TRANSCRIPT
                        </span>
                        <button 
                          onClick={() => downloadNotes(lecture.cleanTranscript!, `${lecture.title}_clean`)}
                          className={`p-1.5 rounded text-current transition-colors ${isLightTheme ? 'bg-gray-200 hover:bg-gray-300' : 'bg-black/20 hover:bg-black/30'}`}
                          title="Download Clean Transcript"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                      <div className={`text-sm max-h-60 overflow-y-auto whitespace-pre-wrap ${isLightTheme ? 'text-gray-800' : 'opacity-90'}`}>
                        {lecture.cleanTranscript}
                      </div>
                    </div>
                  )}

                  {lecture.notes.length > 0 ? (
                    <div className="space-y-4">
                      {lecture.notes.map(note => (
                        <div key={note.id} className={`p-4 rounded-xl ${isLightTheme ? 'bg-white border border-gray-200' : 'bg-white/5'}`}>
                          <div className="flex justify-between items-center mb-3">
                            <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${isLightTheme ? 'bg-gray-200 text-gray-700' : 'opacity-70 bg-black/20'}`}>
                              {note.format.replace('_', ' ')}
                            </span>
                            <div className="flex gap-2">
                              {editingNoteId === note.id ? (
                                <>
                                  <button 
                                    onClick={() => handleEditSave(lecture.id, note.id)}
                                    className="p-1.5 bg-tt-green/20 hover:bg-tt-green/30 text-tt-green rounded transition-colors"
                                    title="Save Notes"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button 
                                    onClick={() => setEditingNoteId(null)}
                                    className="p-1.5 bg-tt-red/20 hover:bg-tt-red/30 text-tt-red rounded transition-colors"
                                    title="Cancel Edit"
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => {
                                      setEditingNoteId(note.id);
                                      setEditContent(note.content);
                                    }}
                                    className={`p-1.5 rounded text-current transition-colors ${isLightTheme ? 'bg-gray-200 hover:bg-gray-300' : 'bg-black/20 hover:bg-black/30'}`}
                                    title="Edit Notes"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button 
                                    onClick={() => shareNotes(note.content, lecture.title)}
                                    className={`p-1.5 rounded text-current transition-colors ${isLightTheme ? 'bg-gray-200 hover:bg-gray-300' : 'bg-black/20 hover:bg-black/30'}`}
                                    title="Share Notes"
                                  >
                                    <Share2 size={14} />
                                  </button>
                                  <button 
                                    onClick={() => addToTasks(lecture.title, note.content)}
                                    className={`p-1.5 rounded text-current transition-colors ${isLightTheme ? 'bg-gray-200 hover:bg-gray-300' : 'bg-black/20 hover:bg-black/30'}`}
                                    title="Add to Tasks"
                                  >
                                    <PlusCircle size={14} />
                                  </button>
                                  <button 
                                    onClick={() => downloadNotes(note.content, lecture.title)}
                                    className={`p-1.5 rounded text-current transition-colors ${isLightTheme ? 'bg-gray-200 hover:bg-gray-300' : 'bg-black/20 hover:bg-black/30'}`}
                                    title="Download Notes"
                                  >
                                    <Download size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {editingNoteId === note.id ? (
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className={`w-full h-64 border rounded-lg p-3 text-sm focus:outline-none focus:border-tt-blue font-mono ${isLightTheme ? 'bg-white border-gray-300 text-gray-900' : 'bg-black/20 border-gray-700'}`}
                            />
                          ) : (
                            <div className={`markdown-body text-sm max-w-none ${isLightTheme ? 'text-gray-800 prose' : 'opacity-90 prose prose-invert'}`}>
                              <Markdown>{note.content}</Markdown>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-sm italic text-center py-4 ${isLightTheme ? 'text-gray-500' : 'opacity-60'}`}>No notes generated yet.</p>
                  )}
                  
                  {(lecture.cleanTranscript || lecture.rawTranscript || lecture.notes.length > 0) && (
                    <StudyMaterialGenerator 
                      sourceText={[
                        lecture.cleanTranscript, 
                        lecture.rawTranscript, 
                        ...lecture.notes.map(n => n.content)
                      ].filter(Boolean).join('\n\n')}
                      onGenerate={(format, content) => {
                        addNoteToLecture(lecture.id, {
                          id: Math.random().toString(36).substr(2, 9),
                          lectureId: lecture.id,
                          format,
                          content,
                          createdAt: new Date().toISOString()
                        });
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Lectures;
