import React, { useState, useRef } from 'react';
import { useUsage } from '../contexts/UsageContext';
import { useAuth } from '../contexts/AuthContext';
import { generateStudyMaterials } from '../services/geminiService';
import { BookOpen, Upload, FileText, Loader, Save, Trash2, CheckCircle, Crown, HelpCircle } from 'lucide-react';
import Markdown from 'react-markdown';
import { GoogleGenAI, Type } from '@google/genai';

const StudyMaterials = () => {
  const { isPro } = useUsage();
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

  const [sourceText, setSourceText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [materialType, setMaterialType] = useState<'flashcards' | 'multiple_choice' | 'short_answer'>('flashcards');
  const [count, setCount] = useState(10);
  
  const [savedMaterials, setSavedMaterials] = useState<Array<{id: string, title: string, content: string, type: string, date: string}>>([]);
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isGenerating) return;
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSourceText(''); // Clear text if file is uploaded
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type.startsWith('text/')) {
      return await file.text();
    }
    
    // For PDFs or images, use Gemini to extract text
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
      const reader = new FileReader();
      
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const base64Data = await base64Promise;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: file.type } },
            { text: `
              Extract all the text from this document. 
              If the document appears to be a quiz, exam, or test:
              - Recognize and preserve all questions.
              - Recognize and preserve all options (A, B, C, D, etc.).
              - Recognize and preserve correct answers if they are indicated.
              - Handle numbered questions, bullet lists, and paragraph questions correctly.
              Return the extracted text clearly formatted.
            ` }
          ]
        }
      });
      
      return response.text || '';
    } catch (error) {
      console.error("Error extracting text from file:", error);
      throw new Error("Some data could not be fully extracted. Please review.");
    }
  };

  const handleGenerate = async () => {
    if (!isPro && count > 10) {
      alert("Upgrade to Pro to generate more than 10 questions at once.");
      return;
    }
    
    if (!sourceText && !selectedFile) {
      alert("Please provide source text or upload a file.");
      return;
    }
    
    setIsGenerating(true);
    try {
      let textToProcess = sourceText;
      
      if (selectedFile && !sourceText) {
        textToProcess = await extractTextFromFile(selectedFile);
      }
      
      if (!textToProcess.trim()) {
        throw new Error("No text found to process.");
      }

      const result = await generateStudyMaterials(textToProcess, materialType, count);
      
      // Convert JSON array to markdown string for saving
      let markdownContent = '';
      if (materialType === 'flashcards' || materialType === 'short_answer') {
        result.forEach((item: any, index: number) => {
          markdownContent += `### Q${index + 1}: ${item.question}\n\n**A:** ${item.answer}\n\n---\n\n`;
        });
      } else if (materialType === 'multiple_choice') {
        result.forEach((item: any, index: number) => {
          markdownContent += `### Q${index + 1}: ${item.question}\n\n`;
          item.options.forEach((opt: string, i: number) => {
            markdownContent += `- [ ] ${opt}\n`;
          });
          markdownContent += `\n**Correct Answer:** ${item.correctAnswer}\n\n---\n\n`;
        });
      }
      
      const newMaterial = {
        id: Math.random().toString(36).substr(2, 9),
        title: `${materialType.replace('_', ' ').toUpperCase()} - ${new Date().toLocaleDateString()}`,
        content: markdownContent,
        type: materialType,
        date: new Date().toISOString()
      };
      
      setSavedMaterials([newMaterial, ...savedMaterials]);
      setActiveMaterialId(newMaterial.id);
      
      // Reset inputs
      setSourceText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
    } catch (error: any) {
      alert(error.message || "Failed to generate study materials. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteMaterial = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedMaterials(savedMaterials.filter(m => m.id !== id));
    if (activeMaterialId === id) setActiveMaterialId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Study Materials Generator
          {isPro && <Crown size={20} className="text-yellow-500" />}
        </h1>
      </div>

      {/* Generator Section */}
      <div className={`glass-panel p-6 rounded-2xl border space-y-6 ${isLightTheme ? 'border-gray-200 bg-white/80' : 'border-gray-700/50'}`}>
        
        {/* Input Area */}
        <div className="space-y-3">
          <label className={`block text-sm font-medium ${isLightTheme ? 'text-gray-700' : 'text-gray-300'}`}>
            Source Material
          </label>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed transition-colors ${selectedFile ? (isLightTheme ? 'border-tt-blue bg-blue-50 text-tt-blue' : 'border-tt-blue bg-tt-blue/10 text-tt-blue') : (isLightTheme ? 'border-gray-300 hover:border-gray-400 text-gray-500' : 'border-gray-700 hover:border-gray-600 text-gray-400')}`}
            >
              <Upload size={24} />
              <span className="text-sm font-medium">
                {selectedFile ? selectedFile.name : 'Upload Document (PDF, TXT, Image)'}
              </span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".txt,.pdf,image/*"
              onChange={handleFileUpload}
            />
            
            <div className="flex items-center justify-center text-sm font-bold opacity-50">OR</div>
            
            <textarea
              value={sourceText}
              onChange={(e) => {
                setSourceText(e.target.value);
                if (e.target.value) setSelectedFile(null);
              }}
              placeholder="Paste your lecture notes or text here..."
              className={`flex-1 h-32 border rounded-xl p-3 text-sm focus:outline-none focus:border-tt-blue resize-none ${isLightTheme ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-400' : 'bg-black/20 border-gray-700 text-white placeholder-gray-600'}`}
            />
          </div>
        </div>

        {/* Options Area */}
        <div className={`pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 ${isLightTheme ? 'border-gray-200' : 'border-gray-700/50'}`}>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <div className="w-full sm:w-auto">
              <label className={`block text-xs font-medium mb-1 ${isLightTheme ? 'text-gray-600' : 'text-gray-400'}`}>Material Type</label>
              <div className={`flex p-1 rounded-lg ${isLightTheme ? 'bg-gray-200' : 'bg-black/20'}`}>
                <button
                  onClick={() => setMaterialType('flashcards')}
                  className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${materialType === 'flashcards' ? 'bg-tt-blue text-white shadow-sm' : isLightTheme ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
                >
                  <BookOpen size={14} /> Flashcards
                </button>
                <button
                  onClick={() => setMaterialType('multiple_choice')}
                  className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${materialType === 'multiple_choice' ? 'bg-tt-blue text-white shadow-sm' : isLightTheme ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
                >
                  <CheckCircle size={14} /> Quiz
                </button>
                <button
                  onClick={() => setMaterialType('short_answer')}
                  className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${materialType === 'short_answer' ? 'bg-tt-blue text-white shadow-sm' : isLightTheme ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
                >
                  <HelpCircle size={14} /> Short Answer
                </button>
              </div>
            </div>
            
            <div className="w-full sm:w-32">
              <label className={`block text-xs font-medium mb-1 ${isLightTheme ? 'text-gray-600' : 'text-gray-400'}`}>
                Count {!isPro && '(Max 10)'}
              </label>
              <input 
                type="number" 
                min="1" 
                max={isPro ? 50 : 10}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-tt-blue ${isLightTheme ? 'bg-white border-gray-300 text-gray-900' : 'bg-black/20 border-gray-700 text-white'}`}
              />
            </div>
          </div>
          
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || (!sourceText && !selectedFile)}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-colors mt-4 sm:mt-0 ${isGenerating || (!sourceText && !selectedFile) ? 'opacity-50 cursor-not-allowed bg-gray-500 text-white' : 'bg-tt-blue hover:bg-blue-600 text-white shadow-lg shadow-tt-blue/20'}`}
          >
            {isGenerating ? <Loader size={18} className="animate-spin" /> : 'Generate'}
          </button>
        </div>
      </div>

      {/* Processing Indicator */}
      {isGenerating && (
        <div className="bg-tt-blue/10 border border-tt-blue/30 rounded-xl p-4 flex items-center gap-3 text-tt-blue">
          <Loader className="animate-spin" size={20} />
          <span className="font-medium">Analyzing content and generating study materials...</span>
        </div>
      )}

      {/* Saved Materials List */}
      <div className="space-y-4">
        <h2 className="font-bold text-lg">Saved Materials</h2>
        
        {savedMaterials.length === 0 ? (
          <div className={`text-center py-10 opacity-50 border-2 border-dashed rounded-xl ${isLightTheme ? 'border-gray-300' : 'border-gray-700/50'}`}>
            <BookOpen size={48} className="mx-auto mb-3 opacity-20" />
            <p>No study materials generated yet.</p>
          </div>
        ) : (
          savedMaterials.map(material => (
            <div key={material.id} className={`glass-panel rounded-xl border overflow-hidden ${isLightTheme ? 'border-gray-200 bg-white/80' : 'border-gray-700/50'}`}>
              <div 
                className={`p-4 flex items-center justify-between cursor-pointer ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-black/5'}`}
                onClick={() => setActiveMaterialId(activeMaterialId === material.id ? null : material.id)}
              >
                <div>
                  <h3 className="font-bold text-current">{material.title}</h3>
                  <p className={`text-xs ${isLightTheme ? 'text-gray-500' : 'opacity-60'}`}>
                    {new Date(material.date).toLocaleDateString()} • {material.type.replace('_', ' ')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={(e) => deleteMaterial(material.id, e)}
                    className="p-2 text-gray-500 hover:text-tt-red transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {activeMaterialId === material.id && (
                <div className={`p-4 border-t ${isLightTheme ? 'border-gray-200 bg-gray-50' : 'border-gray-700/50 bg-black/10'}`}>
                  <div className={`p-4 rounded-xl ${isLightTheme ? 'bg-white border border-gray-200' : 'bg-white/5'}`}>
                    <div className={`markdown-body text-sm max-w-none ${isLightTheme ? 'text-gray-800 prose' : 'opacity-90 prose prose-invert'}`}>
                      <Markdown>{material.content}</Markdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StudyMaterials;
