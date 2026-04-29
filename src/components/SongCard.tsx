/**
 * SongCard Component
 *
 * This component renders a card displaying a song's details, including its cover art,
 * title, artist, duration, and tags. It also features an interactive play button
 * and an info button that reveals the original generation prompt used to create the song.
 *
 * Use Cases:
 * - Displaying example songs in a gallery or list.
 * - Allowing users to preview songs and see the prompts that generated them.
 */
import React, { useState } from 'react';
import { ExampleSong } from '../../types';
import { Icons } from '../../constants';

interface SongCardProps {
  /** The song data to display on the card */
  song: ExampleSong;
  /** Callback function triggered when the play button is clicked */
  onPlay: (song: ExampleSong) => void;
  /** Indicates whether this specific song is currently playing */
  isPlaying: boolean;
}

const SongCard: React.FC<SongCardProps> = ({ song, onPlay, isPlaying }) => {
  // State to toggle the visibility of the generation prompt overlay
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className="group relative bg-white dark:bg-gray-800 rounded-3xl overflow-hidden card-shadow dark:shadow-none dark:border dark:border-gray-700 transition-all duration-300 transform hover:-translate-y-1">
      {/* Cover Art and Overlay Controls */}
      <div className="relative aspect-square overflow-hidden">
        <img 
          src={song.coverUrl} 
          alt={song.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        
        {/* Play/Pause Button Overlay (appears on hover) */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <button 
            onClick={() => onPlay(song)}
            className="w-16 h-16 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-black transition-transform transform hover:scale-110 active:scale-95 shadow-xl"
            aria-label={isPlaying ? "Pause song" : "Play song"}
          >
            {isPlaying ? <Icons.Pause className="w-8 h-8" /> : <Icons.Play className="w-8 h-8 ml-1" />}
          </button>
        </div>
        
        {/* Info Button (toggles prompt overlay) */}
        <div className="absolute top-4 right-4">
          <button 
            onClick={() => setShowPrompt(!showPrompt)}
            className={`p-2 rounded-full backdrop-blur-md transition-all ${showPrompt ? 'bg-blue-500 text-white' : 'bg-white/30 text-white hover:bg-white/50'}`}
            aria-label="Show generation prompt"
          >
            <Icons.Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Song Metadata Details */}
      <div className="p-5">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-lg font-semibold tracking-tight truncate pr-4 text-gray-900 dark:text-white">{song.title}</h3>
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-1">{song.duration}</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{song.artist}</p>
        
        {/* Genre/Mood Tags */}
        <div className="flex flex-wrap gap-2">
          {song.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Generation Prompt Overlay */}
      {showPrompt && (
        <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur p-6 flex flex-col animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Generation Prompt</h4>
            <button onClick={() => setShowPrompt(false)} className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white" aria-label="Close prompt overlay">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 italic flex-1 overflow-y-auto">
            "{song.prompt}"
          </p>
          
          {/* Action Buttons for Prompt */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
             <button className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 transition-colors">
               Copy Prompt
             </button>
             <button className="flex-1 py-2 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
               Remix Song
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SongCard;
