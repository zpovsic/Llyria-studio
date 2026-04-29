/**
 * PromptBuilder Component
 *
 * This component provides a structured UI for users to build complex music prompts.
 * It allows adding multiple sections (e.g., Intro, Verse, Chorus) and selecting
 * attributes like mood, gender/genre, theme, BPM, and scale for each section.
 *
 * Use Cases:
 * - Assisting users who are unfamiliar with writing effective music generation prompts.
 * - Providing a quick way to experiment with different musical combinations.
 */
import React, { useState } from 'react';
import { Icons, PROMPT_HELPER_CONFIG } from '../../constants';
import { getRandomItem } from '../utils/helpers';

export interface HelperSection {
  id: string;
  type: 'main' | 'append';
  mood?: string;
  gender?: string;
  theme?: string;
  timestamp?: string;
  text?: string;
  bpm?: string;
  scale?: string;
  instrument?: string;
  tempoVariation?: string;
  keyChange?: string;
}

export type SelectorType = 'mood' | 'gender' | 'theme' | 'timestamp' | 'bpm' | 'scale' | 'instrument' | 'tempoVariation' | 'keyChange';

interface PromptBuilderProps {
  isHelperOpen: boolean;
  helperSections: HelperSection[];
  setHelperSections: React.Dispatch<React.SetStateAction<HelperSection[]>>;
  activeSelector: { sectionId: string, type: SelectorType } | null;
  setActiveSelector: React.Dispatch<React.SetStateAction<{ sectionId: string, type: SelectorType } | null>>;
  selectedImages: { data: string, mimeType: string, previewUrl: string }[];
  onImageSelect: () => void;
  onImageRemove: (index: number) => void;
}

export const PromptBuilder: React.FC<PromptBuilderProps> = ({
  isHelperOpen,
  helperSections,
  setHelperSections,
  activeSelector,
  setActiveSelector,
  selectedImages,
  onImageSelect,
  onImageRemove
}) => {
  const [customInputValue, setCustomInputValue] = useState('');

  /**
   * Updates a specific section of the prompt helper.
   * @param id The ID of the section to update.
   * @param updates The partial updates to apply to the section.
   */
  const updateHelperSection = (id: string, updates: Partial<HelperSection>) => {
    setHelperSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  /**
   * Adds a new section to the prompt helper.
   */
  const addHelperSection = () => {
    const lastSection = helperSections[helperSections.length - 1];
    let nextTime = "0:30";
    
    if (lastSection && lastSection.timestamp) {
      const parts = lastSection.timestamp.split(':');
      if (parts.length === 2) {
        const currentTotalSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        const nextTotalSeconds = currentTotalSeconds + 30;
        const nextMins = Math.floor(nextTotalSeconds / 60);
        const nextSecs = nextTotalSeconds % 60;
        nextTime = `${nextMins}:${nextSecs.toString().padStart(2, '0')}`;
      }
    }

    const newSection: HelperSection = {
      id: Math.random().toString(36).substring(7),
      type: 'append',
      timestamp: nextTime,
      mood: getRandomItem(PROMPT_HELPER_CONFIG.moods),
      gender: getRandomItem(PROMPT_HELPER_CONFIG.genders)
    };
    setHelperSections(prev => [...prev, newSection]);
  };

  /**
   * Renders a dropdown selector for a specific attribute of a section.
   * @param sectionId The ID of the section.
   * @param type The type of attribute (mood, gender, theme, timestamp, bpm, scale, instrument, tempoVariation, keyChange).
   * @returns The rendered dropdown selector or null if not active.
   */
  const renderSelector = (sectionId: string, type: SelectorType) => {
    if (activeSelector?.sectionId !== sectionId || activeSelector?.type !== type) return null;
    
    const options = type === 'mood' ? PROMPT_HELPER_CONFIG.moods : 
                    type === 'gender' ? PROMPT_HELPER_CONFIG.genders : 
                    type === 'theme' ? PROMPT_HELPER_CONFIG.themes : 
                    type === 'timestamp' ? PROMPT_HELPER_CONFIG.timestamps :
                    type === 'bpm' ? PROMPT_HELPER_CONFIG.bpms :
                    type === 'instrument' ? PROMPT_HELPER_CONFIG.instruments :
                    type === 'tempoVariation' ? PROMPT_HELPER_CONFIG.tempoVariations :
                    type === 'keyChange' ? PROMPT_HELPER_CONFIG.keyChanges :
                    PROMPT_HELPER_CONFIG.scales;
                    
    const section = helperSections.find(s => s.id === sectionId);
    const currentValue = section ? (section[type as keyof HelperSection] as string) : '';

    return (
      <div className="absolute top-full left-0 mt-2 z-[100] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-2 min-w-[200px] animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
          {options.map(opt => (
            <button 
              key={opt} 
              onClick={(e) => { 
                e.stopPropagation(); 
                updateHelperSection(sectionId, { [type]: opt }); 
                setActiveSelector(null); 
              }}
              className={`w-full text-left px-4 py-2 rounded-xl text-sm transition-colors ${currentValue === opt ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            >
              {opt}
            </button>
          ))}
        </div>
        <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
          <div className="flex gap-2 p-1">
            <input 
              type="text" 
              placeholder="Custom..." 
              className="flex-1 bg-gray-50 dark:bg-gray-900 border-none rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 dark:text-gray-200 dark:placeholder-gray-500"
              value={customInputValue}
              onChange={(e) => setCustomInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customInputValue.trim()) {
                  updateHelperSection(sectionId, { [type]: customInputValue.trim() });
                  setCustomInputValue('');
                  setActiveSelector(null);
                }
              }}
            />
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (customInputValue.trim()) {
                  updateHelperSection(sectionId, { [type]: customInputValue.trim() });
                  setCustomInputValue('');
                  setActiveSelector(null);
                }
              }}
              className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg"
            >
              Set
            </button>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Renders an optional value pill (e.g., BPM, Scale) for a section.
   * @param s The section object.
   * @param type The type of attribute (bpm, scale, instrument, tempoVariation, keyChange).
   * @param label The label to display if the value is not set.
   * @returns The rendered value pill.
   */
  const renderOptionalValuePill = (s: HelperSection, type: SelectorType, label: string) => {
    const value = s[type];
    return (
      <div className="relative">
        {value ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector?.sectionId === s.id && activeSelector?.type === type ? null : { sectionId: s.id, type }); }}
            className={`px-3 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-600 dark:text-blue-400 font-bold shadow-sm flex items-center gap-2 hover:border-blue-400 dark:hover:border-blue-600 transition-all text-sm group/pill`}
          >
            {value} <Icons.ChevronDown className="w-3 h-3 opacity-50" />
            <span 
              onClick={(e) => { e.stopPropagation(); updateHelperSection(s.id, { [type]: undefined }); }}
              className="ml-1 text-blue-300 dark:text-blue-500 hover:text-red-400 dark:hover:text-red-400 transition-colors"
            >
              <Icons.X className="w-3.5 h-3.5" />
            </span>
          </button>
        ) : (
          <button 
            onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector?.sectionId === s.id && activeSelector?.type === type ? null : { sectionId: s.id, type }); }}
            className="px-3 py-1 bg-white dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-gray-400 dark:text-gray-500 font-medium hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-500 dark:hover:text-blue-400 transition-all text-xs flex items-center gap-1.5"
          >
            <Icons.Sparkles className="w-3 h-3 opacity-50" />
            {label}
          </button>
        )}
        {renderSelector(s.id, type)}
      </div>
    );
  };

  if (!isHelperOpen) return null;

  return (
    <div className="w-full bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-3xl p-8 space-y-6 transition-all" onClick={e => e.stopPropagation()}>
      {helperSections.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-4 text-xl font-light leading-relaxed dark:text-gray-300">
          {s.type === 'main' ? (
            <>
              <span className="text-gray-400 dark:text-gray-500">Create a</span>
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector?.sectionId === s.id && activeSelector?.type === 'mood' ? null : { sectionId: s.id, type: 'mood' }); }} className={`px-4 py-1.5 bg-white dark:bg-gray-800 border rounded-xl text-blue-600 dark:text-blue-400 font-bold shadow-sm flex items-center gap-2 hover:border-blue-400 dark:hover:border-blue-600 transition-all ${activeSelector?.sectionId === s.id && activeSelector?.type === 'mood' ? 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900' : 'border-blue-200 dark:border-blue-800'}`}>
                  {s.mood} <Icons.ChevronDown className="w-3.5 h-3.5 opacity-50" />
                </button>
                {renderSelector(s.id, 'mood')}
              </div>
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector?.sectionId === s.id && activeSelector?.type === 'gender' ? null : { sectionId: s.id, type: 'gender' }); }} className={`px-4 py-1.5 bg-white dark:bg-gray-800 border rounded-xl text-blue-600 dark:text-blue-400 font-bold shadow-sm flex items-center gap-2 hover:border-blue-400 dark:hover:border-blue-600 transition-all ${activeSelector?.sectionId === s.id && activeSelector?.type === 'gender' ? 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900' : 'border-blue-200 dark:border-blue-800'}`}>
                  {s.gender} <Icons.ChevronDown className="w-3.5 h-3.5 opacity-50" />
                </button>
                {renderSelector(s.id, 'gender')}
              </div>
              <span className="text-gray-400 dark:text-gray-500">song about</span>
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector?.sectionId === s.id && activeSelector?.type === 'theme' ? null : { sectionId: s.id, type: 'theme' }); }} className={`px-4 py-1.5 bg-white dark:bg-gray-800 border rounded-xl text-blue-600 dark:text-blue-400 font-bold shadow-sm flex items-center gap-2 hover:border-blue-400 dark:hover:border-blue-600 transition-all ${activeSelector?.sectionId === s.id && activeSelector?.type === 'theme' ? 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900' : 'border-blue-200 dark:border-blue-800'}`}>
                  {s.theme} <Icons.ChevronDown className="w-3.5 h-3.5 opacity-50" />
                </button>
                {renderSelector(s.id, 'theme')}
              </div>
              {renderOptionalValuePill(s, 'instrument', 'Add Instrument')}
              {renderOptionalValuePill(s, 'bpm', 'Add BPM')}
              {renderOptionalValuePill(s, 'scale', 'Add Scale')}
            </>
          ) : (
            <>
              <span className="text-gray-400 dark:text-gray-500">[From </span>
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector?.sectionId === s.id && activeSelector?.type === 'timestamp' ? null : { sectionId: s.id, type: 'timestamp' }); }} className="px-3 py-1 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-600 dark:text-blue-400 font-bold shadow-sm flex items-center gap-2 hover:border-blue-400 dark:hover:border-blue-600 transition-all text-sm">
                  {s.timestamp} <Icons.ChevronDown className="w-3 h-3 opacity-50" />
                </button>
                {renderSelector(s.id, 'timestamp')}
              </div>
              <span className="text-gray-400 dark:text-gray-500">] the song transitions to a </span>
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector?.sectionId === s.id && activeSelector?.type === 'mood' ? null : { sectionId: s.id, type: 'mood' }); }} className="px-3 py-1 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-600 dark:text-blue-400 font-bold shadow-sm flex items-center gap-2 hover:border-blue-400 dark:hover:border-blue-600 transition-all text-sm">
                  {s.mood} <Icons.ChevronDown className="w-3 h-3 opacity-50" />
                </button>
                {renderSelector(s.id, 'mood')}
              </div>
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector?.sectionId === s.id && activeSelector?.type === 'gender' ? null : { sectionId: s.id, type: 'gender' }); }} className="px-3 py-1 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-600 dark:text-blue-400 font-bold shadow-sm flex items-center gap-2 hover:border-blue-400 dark:hover:border-blue-600 transition-all text-sm">
                  {s.gender} <Icons.ChevronDown className="w-3 h-3 opacity-50" />
                </button>
                {renderSelector(s.id, 'gender')}
              </div>
              <span className="text-gray-400 dark:text-gray-500"> song.</span>
              {renderOptionalValuePill(s, 'instrument', 'Add Instrument')}
              {renderOptionalValuePill(s, 'tempoVariation', 'Tempo Change')}
              {renderOptionalValuePill(s, 'keyChange', 'Key Change')}
              {renderOptionalValuePill(s, 'scale', 'Add Scale')}
              <button onClick={(e) => { e.stopPropagation(); setHelperSections(prev => prev.filter(sec => sec.id !== s.id)); }} className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 transition-colors p-1 ml-auto"><Icons.X className="w-5 h-5" /></button>
            </>
          )}
        </div>
      ))}

      <div className="pt-8 flex flex-col gap-4">
        {selectedImages.length > 0 && (
          <div className="relative flex items-center group/carousel">
            {selectedImages.length > 3 && (
              <button 
                onClick={(e) => { e.stopPropagation(); document.getElementById('helper-image-carousel')?.scrollBy({ left: -200, behavior: 'smooth' }); }}
                className="absolute left-0 z-10 -ml-4 w-8 h-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
              >
                <Icons.ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div id="helper-image-carousel" className="flex gap-4 overflow-x-auto snap-x snap-mandatory py-2 px-1 w-full hide-scrollbar">
              {selectedImages.map((img, idx) => (
                <div key={idx} className="relative group rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 w-24 h-24 flex-shrink-0 shadow-sm snap-start">
                  <img src={img.previewUrl} alt={`Selected ${idx}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={(e) => { e.stopPropagation(); onImageRemove(idx); }} className="text-white hover:text-red-400 p-2">
                      <Icons.X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {selectedImages.length > 3 && (
              <button 
                onClick={(e) => { e.stopPropagation(); document.getElementById('helper-image-carousel')?.scrollBy({ left: 200, behavior: 'smooth' }); }}
                className="absolute right-0 z-10 -mr-4 w-8 h-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
              >
                <Icons.ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {selectedImages.length < 10 && (
            <button 
              title="By using this feature, you confirm that you have the necessary rights to any content that you upload. Do not generate content that infringes on others’ intellectual property or privacy rights. Your use of this generative AI service is subject to our Prohibited Use Policy."
              onClick={(e) => { e.stopPropagation(); onImageSelect(); }}
              className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-bold transition-all border shadow-sm bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/30`}
            >
              <Icons.Camera className="w-5 h-5" />
              Add a picture {selectedImages.length > 0 ? `(${selectedImages.length}/10)` : ''}
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); addHelperSection(); }}
            className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 font-bold shadow-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
          >
            <Icons.Sparkles className="w-5 h-5" />
            Add another section to the song
          </button>
        </div>
      </div>
    </div>
  );
};
