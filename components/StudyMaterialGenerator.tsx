import React, { useState } from 'react';
import { generateStudyMaterials } from '../services/geminiService';
import { useUsage } from '../contexts/UsageContext';
import { useAuth } from '../contexts/AuthContext';
import { Loader, BookOpen, HelpCircle, CheckSquare, Crown } from 'lucide-react';

interface StudyMaterialGeneratorProps {
  sourceText: string;
  onGenerate: (format: 'flashcards' | 'multiple_choice' | 'short_answer', content: string) => void;
}

const StudyMaterialGenerator: React.FC<StudyMaterialGeneratorProps> = ({ sourceText, onGenerate }) => {
  const { isPro } = useUsage();
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [materialType, setMaterialType] = useState<'flashcards' | 'multiple_choice' | 'short_answer'>('flashcards');
  const [count, setCount] = useState(10);

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

  const handleGenerate = async () => {
    if (!isPro && count > 10) {
      alert("Upgrade to Pro to generate more than 10 questions at once.");
      return;
    }
    
    setIsGenerating(true);
    try {
      const result = await generateStudyMaterials(sourceText, materialType, count);
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
      
      onGenerate(materialType, markdownContent);
    } catch (error) {
      alert("Failed to generate study materials. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`p-4 rounded-xl border mt-4 ${isLightTheme ? 'bg-white border-gray-200' : 'bg-white/5 border-gray-700/50'}`}>
      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
        <BookOpen size={18} className="text-tt-blue" />
        Generate Study Materials
      </h3>
      
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
        <div className="flex-1 w-full">
          <label className={`block text-xs font-medium mb-1 ${isLightTheme ? 'text-gray-600' : 'text-gray-400'}`}>Material Type</label>
          <div className={`flex p-1 rounded-lg ${isLightTheme ? 'bg-gray-200' : 'bg-black/20'}`}>
            <button
              onClick={() => setMaterialType('flashcards')}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-bold transition-colors ${materialType === 'flashcards' ? 'bg-tt-blue text-white shadow-sm' : isLightTheme ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
            >
              <BookOpen size={14} /> Flashcards
            </button>
            <button
              onClick={() => setMaterialType('multiple_choice')}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-bold transition-colors ${materialType === 'multiple_choice' ? 'bg-tt-blue text-white shadow-sm' : isLightTheme ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
            >
              <CheckSquare size={14} /> Quiz (MCQ)
            </button>
            <button
              onClick={() => setMaterialType('short_answer')}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-bold transition-colors ${materialType === 'short_answer' ? 'bg-tt-blue text-white shadow-sm' : isLightTheme ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
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
        
        <button 
          onClick={handleGenerate}
          disabled={isGenerating || !sourceText}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold transition-colors ${isGenerating || !sourceText ? 'opacity-50 cursor-not-allowed bg-gray-500 text-white' : 'bg-tt-blue hover:bg-blue-600 text-white shadow-lg shadow-tt-blue/20'}`}
        >
          {isGenerating ? <Loader size={16} className="animate-spin" /> : 'Generate'}
        </button>
      </div>
      
      {!isPro && (
        <p className={`text-xs mt-3 flex items-center gap-1 ${isLightTheme ? 'text-gray-500' : 'text-gray-400'}`}>
          <Crown size={12} className="text-yellow-500" />
          Pro users get unlimited generation.
        </p>
      )}
    </div>
  );
};

export default StudyMaterialGenerator;
