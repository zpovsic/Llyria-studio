/**
 * Main Application Component for Lyria Studio
 *
 * This component serves as the primary container for the Lyria Studio application.
 * It manages the global state for music generation, including user inputs (prompts,
 * duration, lyrics options, image uploads), the generation process, and the display
 * of generated results.
 *
 * Key Features:
 * - Prompt building (manual or via the PromptBuilder helper)
 * - Image upload for visual prompting
 * - Integration with Google GenAI for audio generation
 * - Audio playback and video export functionality
 * - Display of generated lyrics and metadata (title, cover art)
 */
import React, { useState, useRef, useEffect } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import { Duration, LyricsOption, GenerationState, SongResult } from "./types";
import { Icons, PROMPT_HELPER_CONFIG } from "./constants";
import { CONFIG } from "./src/config";
import { logFunctionCall } from "./src/utils/logger";
import { createAudioUrlFromBase64 } from "./src/utils/audioUtils";
import { cleanLyricsForDisplay } from "./src/utils/lyricsUtils";
import { handleDownloadVideo } from "./src/utils/videoUtils";
import {
  parseModelOutput,
  generateSongTitle,
  generateCoverArt,
} from "./src/services/genaiService";
import { getRandomItem } from "./src/utils/helpers";
import {
  PromptBuilder,
  HelperSection,
  SelectorType,
} from "./src/components/PromptBuilder";
import { AudioVisualizer } from "./src/components/AudioVisualizer";

const App: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [isPromptManual, setIsPromptManual] = useState(false);
  const [duration, setDuration] = useState<Duration>("Clip (30s)");
  const [lyricsOption, setLyricsOption] = useState<LyricsOption>("Auto");
  const [customLyrics, setCustomLyrics] = useState("");
  const [gen, setGen] = useState<GenerationState>(() => {
    try {
      const saved = localStorage.getItem("lyria-songs");
      if (saved) {
        const parsed = JSON.parse(saved) as SongResult[];
        const rehydrated = parsed.map((r) => ({
          ...r,
          timestamp: new Date(r.timestamp),
          audioUrl: r.audioBase64
            ? createAudioUrlFromBase64(
                r.audioBase64,
                r.audioMimeType || "audio/wav",
              )
            : null,
          isExpanded: false,
        }));
        return { results: rehydrated };
      }
    } catch (e) {
      console.error("Failed to load saved songs:", e);
    }
    return { results: [] };
  });
  const [isResultPlaying, setIsResultPlaying] = useState<string | null>(null);
  const [encodingVideoId, setEncodingVideoId] = useState<string | null>(null);
  const [encodingProgress, setEncodingProgress] = useState(0);
  const [selectedImages, setSelectedImages] = useState<
    { data: string; mimeType: string; previewUrl: string }[]
  >([]);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("lyria-theme");
    return (
      saved === "dark" ||
      (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });

  // Helper Mode States
  const [isHelperOpen, setIsHelperOpen] = useState(false);
  const [helperSections, setHelperSections] = useState<HelperSection[]>([
    {
      id: "initial",
      type: "main",
      mood: getRandomItem(PROMPT_HELPER_CONFIG.moods),
      gender: getRandomItem(PROMPT_HELPER_CONFIG.genders),
      theme: getRandomItem(PROMPT_HELPER_CONFIG.themes),
    },
  ]);
  const [activeSelector, setActiveSelector] = useState<{
    sectionId: string;
    type: SelectorType;
  } | null>(null);

  const consoleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("lyria-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("lyria-theme", "light");
    }
  }, [isDarkMode]);

  // Persist completed/error results to localStorage
  useEffect(() => {
    const toSave = gen.results.filter(
      (r) => r.status === "completed" || r.status === "error",
    );
    if (toSave.length === 0) {
      localStorage.removeItem("lyria-songs");
      return;
    }
    try {
      localStorage.setItem("lyria-songs", JSON.stringify(toSave));
    } catch (e) {
      console.warn(
        "Failed to save songs to localStorage (likely quota exceeded):",
        e,
      );
    }
  }, [gen.results]);

  useEffect(() => {
    if (promptTextareaRef.current) {
      promptTextareaRef.current.style.height = "auto";
      promptTextareaRef.current.style.height = `${promptTextareaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  // Sync Helper sections to Prompt
  useEffect(() => {
    if (isHelperOpen) {
      const generated = helperSections
        .map((s) => {
          const scaleInfo = s.scale
            ? ` in the scale of ${s.scale.toLowerCase()}`
            : "";
          const instrumentInfo = s.instrument
            ? ` featuring ${s.instrument.toLowerCase()}`
            : "";
          const tempoInfo = s.tempoVariation
            ? `, ${s.tempoVariation.toLowerCase()}`
            : "";
          const keyChangeInfo = s.keyChange
            ? `, then ${s.keyChange.toLowerCase()}`
            : "";

          if (s.type === "main") {
            const bpmInfo = s.bpm ? ` at ${s.bpm.toLowerCase()}` : "";
            const musicDetails = `${bpmInfo}${scaleInfo}${instrumentInfo}`;
            return `Create a ${s.mood?.toLowerCase()} ${s.gender?.toLowerCase()} song about ${s.theme?.toLowerCase()}${musicDetails}.`;
          } else {
            const musicDetails = `${scaleInfo}${instrumentInfo}${tempoInfo}${keyChangeInfo}`;
            return `[From ${s.timestamp}] the song transitions to a ${s.mood?.toLowerCase()} ${s.gender?.toLowerCase()} song${musicDetails}.`;
          }
        })
        .join("\n");
      setPrompt(generated);
      setIsPromptManual(false); // Helper sync is not "manual typing"
    }
  }, [isHelperOpen, helperSections]);

  useEffect(() => {
    Object.values(consoleRefs.current).forEach((el) => {
      if (el) {
        (el as HTMLDivElement).scrollTop = (el as HTMLDivElement).scrollHeight;
      }
    });
  }, [gen.results]);

  const handleSelectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Limit to 10 images total
    const remainingSlots = 10 - selectedImages.length;
    const filesToProcess = files.slice(0, remainingSlots);

    filesToProcess.forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        setSelectedImages((prev) => [
          ...prev,
          {
            data: base64,
            mimeType: file.type,
            previewUrl: URL.createObjectURL(file),
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].previewUrl);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleFeelingLucky = () => {
    // Check if the prompt is manual and not empty. If so, do nothing.
    if (isPromptManual && prompt.trim() !== "") return;

    const randomMood = getRandomItem(PROMPT_HELPER_CONFIG.moods);
    const randomGender = getRandomItem(PROMPT_HELPER_CONFIG.genders);
    const randomTheme = getRandomItem(PROMPT_HELPER_CONFIG.themes);

    setPrompt(
      `Create a ${randomMood.toLowerCase()} ${randomGender.toLowerCase()} song about ${randomTheme.toLowerCase()}.`,
    );
    setIsPromptManual(false); // Mark as generated
  };

  const updateHelperSection = (id: string, updates: Partial<HelperSection>) => {
    setHelperSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  };

  const updateResult = (
    id: string,
    updater: (prev: SongResult) => SongResult,
  ) => {
    setGen((prev) => ({
      results: prev.results.map((r) => (r.id === id ? updater(r) : r)),
    }));
  };

  const removeResult = (id: string) => {
    setGen((prev) => ({
      results: prev.results.filter((r) => r.id !== id),
    }));
  };

  const addLog = (id: string, message: string) => {
    updateResult(id, (prev) => ({
      ...prev,
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${message}`],
    }));
  };

  const toggleExpand = (id: string) => {
    setGen((prev) => ({
      results: prev.results.map((r) =>
        r.id === id ? { ...r, isExpanded: !r.isExpanded } : r,
      ),
    }));
  };

  const handleGenerateSongTitle = async (
    id: string,
    musicPrompt: string,
    lyricContext: string,
  ) => {
    addLog(id, "Decoding narrative architecture for title...");
    const title = await generateSongTitle(musicPrompt, lyricContext);
    updateResult(id, (r) => ({ ...r, title }));
    addLog(id, `Identity confirmed: "${title}"`);
    return title;
  };

  const handleGenerateCoverArt = async (
    id: string,
    musicPrompt: string,
    lyricContext: string,
    title?: string,
  ) => {
    addLog(id, "Synthesizing visual representation...");
    const base64Image = await generateCoverArt(
      musicPrompt,
      lyricContext,
      title,
    );
    if (base64Image) {
      updateResult(id, (r) => ({ ...r, coverImageUrl: base64Image }));
      addLog(id, "Visual synthesis finalized.");
    } else {
      addLog(id, "Visual synthesis skipped.");
    }
  };

  const handleGenerate = async (overrides?: {
    prompt: string;
    duration: Duration;
    lyricsOption: LyricsOption;
    customLyrics?: string;
  }) => {
    const activePrompt = overrides?.prompt ?? prompt;
    const activeDuration = overrides?.duration ?? duration;
    const activeLyricsOption = overrides?.lyricsOption ?? lyricsOption;
    const activeCustomLyrics = overrides?.customLyrics ?? customLyrics;
    if (!activePrompt.trim()) return;

    // Check for API key if Pro or Clip model is selected
    if (activeDuration === "Pro" || activeDuration === "Clip (30s)") {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          if ((window as any).aistudio?.openSelectKey) {
            await (window as any).aistudio.openSelectKey();
          }
          return; // Stop generation so the user can select the key and try again
        }
      }
    }

    setIsTriggering(true);
    setTimeout(() => setIsTriggering(false), 200);

    const newId = Math.random().toString(36).substring(7);
    const newResult: SongResult = {
      id: newId,
      status: "generating",
      logs: [],
      audioUrl: null,
      coverImageUrl: null,
      title: null,
      lyrics: "",
      metadata: "",
      fullPrompt: null,
      error: null,
      duration: activeDuration,
      timestamp: new Date(),
      isExpanded: true,
      originalPrompt: activePrompt,
      originalDuration: activeDuration,
      originalLyricsOption: activeLyricsOption,
    };
    setGen((prev) => ({
      results: [
        newResult,
        ...prev.results.map((r) => ({ ...r, isExpanded: false })),
      ],
    }));
    setTimeout(() => {
      document
        .getElementById(`result-${newId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    const modelId =
      activeDuration === "Pro" ? CONFIG.MODEL_ID_FULL : CONFIG.MODEL_ID_SHORT;
    const modelDisplayName =
      activeDuration === "Pro" ? "Lyria Pro" : "Lyria Clip";
    addLog(newId, `Waking ${modelDisplayName} engine...`);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let lyricInstruction =
        activeLyricsOption === "Instrumental"
          ? "IMPORTANT: This track MUST be strictly INSTRUMENTAL."
          : activeLyricsOption === "Custom"
            ? `\nUse these exact lyrics:\n ${activeCustomLyrics}`
            : "\nGenerate lyrics with precise [seconds:] timing markers.";
      const promptText = `Generate a ${activeDuration === "Pro" ? "full-length" : "30-second"} track. \nContext: "${activePrompt}". ${lyricInstruction}.`;

      // Save the full prompt for display later
      updateResult(newId, (r) => ({ ...r, fullPrompt: promptText }));

      const contents: any =
        selectedImages.length > 0
          ? {
              parts: [
                { text: promptText },
                ...selectedImages.map((img) => ({
                  inlineData: { data: img.data, mimeType: img.mimeType },
                })),
              ],
            }
          : promptText;
      const responseStream = await ai.models.generateContentStream({
        model: modelId,
        contents: contents,
        config: { responseModalities: [Modality.AUDIO, Modality.TEXT] },
      });
      let audioAccumulator = "";
      let textAccumulator = "";
      let mimeType = "audio/wav";
      let auxTriggered = false;
      let currentPartType = "";
      let textPartsSeen = 0;

      for await (const chunk of responseStream) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) {
          console.log(
            "[Stream] chunk with no parts:",
            JSON.stringify(chunk).substring(0, 200),
          );
          continue;
        }
        for (const part of parts) {
          if (part.inlineData?.data) {
            currentPartType = "audio";
            if (!audioAccumulator && part.inlineData.mimeType)
              mimeType = part.inlineData.mimeType;
            audioAccumulator += part.inlineData.data;
          }
          if (part.text) {
            if (currentPartType !== "text") {
              textPartsSeen++;
              currentPartType = "text";
            }
            if (textPartsSeen === 1) {
              textAccumulator += part.text;
              const { lyrics, metadata } = parseModelOutput(textAccumulator);
              updateResult(newId, (r) => ({ ...r, lyrics, metadata }));
              if (!auxTriggered && textAccumulator.length > 50) {
                auxTriggered = true;
                handleGenerateSongTitle(
                  newId,
                  activePrompt,
                  textAccumulator,
                ).then((t) =>
                  handleGenerateCoverArt(
                    newId,
                    activePrompt,
                    textAccumulator,
                    t,
                  ),
                );
              }
            }
          }
        }
      }
      console.log("[Raw Generated Lyrics]", textAccumulator);
      if (audioAccumulator) {
        updateResult(newId, (r) => ({
          ...r,
          status: "completed",
          audioUrl: createAudioUrlFromBase64(audioAccumulator, mimeType),
          audioBase64: audioAccumulator,
          audioMimeType: mimeType,
        }));
        addLog(newId, "Signal stabilized.");
      } else throw new Error("Zero audio bits captured.");
    } catch (err: any) {
      console.error("[Generation Error]", err);
      updateResult(newId, (r) => ({
        ...r,
        status: "error",
        error: err.message || "Synthesis interrupted.",
      }));
      addLog(newId, `Error: ${err.message}`);

      if (err?.message === "Zero audio bits captured.") {
        removeResult(newId);
      }
    }
  };

  const handleDownload = (result: SongResult) => {
    if (!result.audioUrl) return;
    const link = document.createElement("a");
    link.href = result.audioUrl;
    link.download = `${result.title || "Lyria"}.wav`;
    link.click();
  };

  const onDownloadVideo = async (
    result: SongResult,
    withLyrics: boolean = false,
  ) => {
    if (!result.audioUrl || !result.coverImageUrl || encodingVideoId) return;
    setEncodingVideoId(result.id);
    setEncodingProgress(0);

    await handleDownloadVideo(
      result,
      withLyrics,
      (progress) => setEncodingProgress(progress),
      () => {
        setEncodingVideoId(null);
        setEncodingProgress(0);
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleGenerate();
  };

  return (
    <div
      className="min-h-screen flex flex-col pb-12 overflow-x-hidden"
      onClick={() => setActiveSelector(null)}
    >
      <nav className="sticky top-0 z-50 glass border-b border-gray-200/50 dark:border-gray-800/50 h-11 flex items-center px-4 justify-between transition-colors duration-300">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 music-gradient rounded-md flex items-center justify-center text-white font-bold text-[8px]">
            LYRIA
          </div>
          <span className="font-semibold text-sm tracking-tight dark:text-white">
            Studio
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Toggle dark mode"
          >
            {isDarkMode ? (
              <Icons.Sun className="w-4 h-4 text-gray-400" />
            ) : (
              <Icons.Moon className="w-4 h-4 text-gray-500" />
            )}
          </button>
          <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest border border-gray-200 dark:border-gray-700">
            lyria 3 preview
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-8">
        <section className="text-center mb-10 space-y-2">
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight transition-colors duration-300">
            Create your sound
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-light leading-relaxed transition-colors duration-300">
            Synthesis of professional music from narrative engineering.
          </p>
        </section>

        <section className="bg-white dark:bg-[#1a1d24] rounded-[24px] p-5 md:p-8 card-shadow border border-gray-100 dark:border-gray-800 mb-8 relative z-10 transition-colors duration-300">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex justify-between items-end mb-1">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                  Track Directives (Ctrl + Enter to send)
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsHelperOpen(!isHelperOpen);
                    }}
                    className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors ${isHelperOpen ? "text-blue-600 dark:text-blue-400" : "text-blue-400 dark:text-blue-500 hover:text-blue-600 dark:hover:text-blue-400"}`}
                  >
                    <Icons.Sparkles className="w-3.5 h-3.5" />
                    {isHelperOpen ? "Free Text" : "Help me create"}
                  </button>
                </div>
              </div>

              <div className="relative group/prompt min-h-[100px]">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  multiple
                  title="Upload reference images"
                  aria-label="Upload reference images"
                  className="hidden"
                />
                {isHelperOpen ? (
                  <PromptBuilder
                    isHelperOpen={isHelperOpen}
                    helperSections={helperSections}
                    setHelperSections={setHelperSections}
                    activeSelector={activeSelector}
                    setActiveSelector={setActiveSelector}
                    selectedImages={selectedImages}
                    onImageSelect={() => fileInputRef.current?.click()}
                    onImageRemove={removeImage}
                  />
                ) : (
                  <div className="relative">
                    <textarea
                      ref={promptTextareaRef}
                      value={prompt}
                      onChange={(e) => {
                        setPrompt(e.target.value);
                        setIsPromptManual(true);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Atmospheric cinematic track with heavy sub-bass..."
                      className="w-full min-h-[90px] overflow-hidden bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-2xl p-4 pb-14 text-sm font-light leading-relaxed resize-none focus:bg-white dark:focus:bg-gray-800 transition-all pr-12 dark:text-gray-200 dark:placeholder-gray-500"
                    />
                    <div className="absolute bottom-4 left-4 flex items-center gap-2">
                      <button
                        title="By using this feature, you confirm that you have the necessary rights to any content that you upload. Do not generate content that infringes on others’ intellectual property or privacy rights. Your use of this generative AI service is subject to our Prohibited Use Policy."
                        onClick={() => fileInputRef.current?.click()}
                        className={`p-2.5 rounded-2xl transition-all shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center ${selectedImages.length > 0 ? "bg-blue-500 text-white" : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400"}`}
                      >
                        <Icons.Camera className="w-5 h-5" />
                      </button>
                      {selectedImages.length > 0 && (
                        <div className="relative flex items-center group/carousel max-w-[60vw] md:max-w-[400px]">
                          {selectedImages.length > 4 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                document
                                  .getElementById("main-image-carousel")
                                  ?.scrollBy({
                                    left: -100,
                                    behavior: "smooth",
                                  });
                              }}
                              title="Scroll uploaded images left"
                              className="absolute left-0 z-10 -ml-3 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-md text-gray-500 hover:text-blue-600 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
                            >
                              <Icons.ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <div
                            id="main-image-carousel"
                            className="flex gap-2 overflow-x-auto snap-x snap-mandatory py-1 px-1 w-full hide-scrollbar"
                          >
                            {selectedImages.map((img, idx) => (
                              <div
                                key={idx}
                                className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-white shadow-lg animate-in zoom-in duration-200 flex-shrink-0 snap-start"
                              >
                                <img
                                  src={img.previewUrl}
                                  alt={`Uploaded reference ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  onClick={() => removeImage(idx)}
                                  title={`Remove uploaded image ${idx + 1}`}
                                  className="absolute top-0 right-0 w-4 h-4 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur hover:bg-black"
                                >
                                  <Icons.X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                          {selectedImages.length > 4 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                document
                                  .getElementById("main-image-carousel")
                                  ?.scrollBy({ left: 100, behavior: "smooth" });
                              }}
                              title="Scroll uploaded images right"
                              className="absolute right-0 z-10 -mr-3 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-md text-gray-500 hover:text-blue-600 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
                            >
                              <Icons.ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-4 right-4">
                      <button
                        title="I'm feeling lucky"
                        onClick={handleFeelingLucky}
                        className={`p-2.5 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 rounded-2xl transition-transform active:scale-90 ${isPromptManual && prompt.trim() !== "" ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
                      >
                        <Icons.Sparkles className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                  Length
                </label>
                <div className="flex bg-gray-100 dark:bg-gray-800/50 p-1 rounded-2xl w-fit">
                  {(["Clip (30s)", "Pro"] as Duration[]).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setDuration(opt)}
                      className={`px-5 py-1.5 rounded-lg text-xs font-semibold transition-all ${duration === opt ? "bg-white dark:bg-gray-700 shadow-sm text-black dark:text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                  Lyrics
                </label>
                <div className="flex bg-gray-100 dark:bg-gray-800/50 p-1 rounded-2xl w-fit">
                  {(["Auto", "Custom", "Instrumental"] as LyricsOption[]).map(
                    (opt) => (
                      <button
                        key={opt}
                        onClick={() => setLyricsOption(opt)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${lyricsOption === opt ? "bg-white dark:bg-gray-700 shadow-sm text-black dark:text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"}`}
                      >
                        {opt}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>

            {lyricsOption === "Custom" && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                  Custom Composition Lyrics
                </label>
                <textarea
                  value={customLyrics}
                  onChange={(e) => setCustomLyrics(e.target.value)}
                  placeholder={`[0:00 - 0:15] Hey this is your song\n[0:15 - ] You can write any lyrics you want`}
                  className="w-full min-h-[100px] bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-2xl p-4 text-sm font-light leading-relaxed resize-none focus:bg-white dark:focus:bg-gray-800 transition-all custom-scrollbar dark:text-gray-200 dark:placeholder-gray-500"
                />
              </div>
            )}

            <button
              onClick={() => handleGenerate()}
              disabled={!prompt.trim() || CONFIG.IS_MAINTENANCE_MODE}
              className={`w-full py-3 rounded-2xl text-sm font-bold text-white transition-all shadow-xl ${
                !prompt.trim() || CONFIG.IS_MAINTENANCE_MODE
                  ? "bg-gray-400 cursor-not-allowed shadow-none"
                  : `music-gradient shadow-red-500/20 active:scale-[0.98] active:brightness-110 ${isTriggering ? "scale-[0.98] brightness-125 ring-4 ring-pink-200" : ""}`
              }`}
            >
              Generate Song
            </button>
          </div>
        </section>

        {gen.results.length > 0 && (
          <div className="relative mb-8 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200/60 dark:border-gray-800/60"></div>
            </div>
            <div className="relative bg-[#fbfbfd] dark:bg-[#0f1115] px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 transition-colors duration-300">
              Songs Gallery
            </div>
          </div>
        )}

        <div className="space-y-6">
          {gen.results.map((result) => {
            const isExpanded = result.isExpanded;
            const isEncoding = encodingVideoId === result.id;
            const isGenerating = result.status === "generating";
            const isFailed = result.status === "error";

            return (
              <div
                id={`result-${result.id}`}
                key={result.id}
                className="group relative transition-all duration-700 ease-in-out transform"
              >
                <div
                  className={`relative transition-all duration-700 ease-in-out border shadow-lg rounded-[24px] ${isGenerating ? "generating-card border-blue-400/60 dark:border-blue-500/40" : "border-gray-200/60 dark:border-gray-700/60"} ${isExpanded ? "p-5 pb-8" : "p-3"}`}
                >
                  <div className="absolute inset-0 z-0 rounded-[24px] overflow-hidden">
                    {result.coverImageUrl && (
                      <img
                        src={result.coverImageUrl}
                        alt={`${result.title || "Generated song"} cover art background`}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    <div
                      className={`absolute inset-0 transition-opacity duration-700 ease-in-out backdrop-blur-2xl ${isExpanded ? "bg-white/75 dark:bg-gray-900/80 opacity-100" : "bg-white/85 dark:bg-gray-900/90 opacity-100"}`}
                    />
                    {result.audioUrl && (
                      <AudioVisualizer
                        audioElementId={`audio-${result.id}`}
                        isPlaying={isResultPlaying === result.id}
                      />
                    )}
                  </div>

                  <div
                    className={`relative z-[30] flex transition-all duration-700 ease-in-out gap-6 items-center ${isExpanded ? "flex-col md:flex-row mb-8 cursor-default" : "flex-row cursor-pointer"}`}
                    onClick={() => !isExpanded && toggleExpand(result.id)}
                  >
                    <div
                      className={`relative shrink-0 transition-all duration-700 ease-in-out rounded-3xl overflow-hidden shadow-2xl ${isExpanded ? "w-48 h-48 md:w-56 md:h-56" : "w-16 h-16"}`}
                    >
                      {result.coverImageUrl ? (
                        <img
                          src={result.coverImageUrl}
                          alt={`${result.title || "Generated song"} cover art`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100/50 dark:bg-gray-800/50">
                          <Icons.Sparkles
                            className={`text-blue-300 dark:text-blue-500 ${isExpanded ? "w-12 h-12 animate-pulse" : "w-5 h-5"}`}
                          />
                        </div>
                      )}
                      {isEncoding && (
                        <div className="absolute inset-0 bg-white/40 dark:bg-gray-900/60 backdrop-blur-[2px] flex items-center justify-center">
                          <Icons.Loading
                            className={`${isExpanded ? "w-12 h-12" : "w-6 h-6"} text-blue-600 dark:text-blue-400 animate-spin`}
                          />
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isGenerating) return;
                          const audio = document.getElementById(
                            `audio-${result.id}`,
                          ) as HTMLAudioElement;
                          if (audio)
                            audio.paused ? audio.play() : audio.pause();
                        }}
                        disabled={
                          (!result.audioUrl && !isGenerating) || isEncoding
                        }
                        title={
                          isGenerating
                            ? "Generating audio"
                            : isResultPlaying === result.id
                              ? "Pause audio"
                              : "Play audio"
                        }
                        className={`absolute inset-0 flex items-center justify-center text-white z-10 transition-opacity duration-300 ${isExpanded || isGenerating ? "opacity-100" : "opacity-0 group-hover:opacity-100"} ${isEncoding ? "cursor-wait" : "cursor-pointer"}`}
                      >
                        <div
                          className={`music-gradient backdrop-blur-xl rounded-full flex items-center justify-center border border-white/40 dark:border-white/20 shadow-2xl hover:scale-110 transition-transform ${isExpanded ? "w-16 h-16" : "w-10 h-10"}`}
                        >
                          {isGenerating ? (
                            <Icons.Loading
                              className={`${isExpanded ? "w-8 h-8" : "w-5 h-5"} animate-spin`}
                            />
                          ) : isResultPlaying === result.id ? (
                            <Icons.Pause
                              className={isExpanded ? "w-8 h-8" : "w-5 h-5"}
                            />
                          ) : (
                            <Icons.Play
                              className={`${isExpanded ? "w-8 h-8" : "w-5 h-5"} ml-1`}
                            />
                          )}
                        </div>
                      </button>
                    </div>

                    <div
                      className={`flex-1 min-w-0 transition-all duration-700 ease-in-out ${isExpanded ? "text-center md:text-left" : ""}`}
                    >
                      <div className="space-y-1 relative">
                        <div
                          className={`flex items-center gap-4 ${isExpanded ? "justify-center md:justify-start flex-wrap" : ""}`}
                        >
                          {isExpanded && !isGenerating && !isFailed ? (
                            <input
                              type="text"
                              value={result.title || ""}
                              placeholder="Untitled Composition"
                              onChange={(e) =>
                                updateResult(result.id, (r) => ({
                                  ...r,
                                  title: e.target.value,
                                }))
                              }
                              className="font-extrabold text-blue-900 dark:text-blue-100 tracking-tight transition-all duration-700 ease-in-out truncate text-xl md:text-2xl bg-transparent border-b-2 border-transparent hover:border-blue-200 dark:hover:border-blue-800 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none flex-1 min-w-[200px] dark:placeholder-gray-600"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <>
                              <h4
                                className={`font-extrabold text-blue-900 dark:text-blue-100 tracking-tight transition-all duration-700 ease-in-out truncate ${isExpanded ? "text-xl md:text-2xl" : "text-sm"}`}
                              >
                                {isFailed
                                  ? "Processing Failed"
                                  : result.title ||
                                    (isGenerating
                                      ? "Synthesizing..."
                                      : "Untitled Composition")}
                              </h4>
                              {isFailed && result.error && (
                                <p
                                  className="text-sm text-red-500 dark:text-red-400 mt-1 truncate max-w-full"
                                  title={result.error}
                                >
                                  {result.error}
                                </p>
                              )}
                            </>
                          )}
                          {(isFailed || result.audioUrl) && (
                            <div
                              className="relative"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() =>
                                  handleGenerate({
                                    prompt: result.originalPrompt,
                                    duration: result.originalDuration,
                                    lyricsOption: result.originalLyricsOption,
                                  })
                                }
                                className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-300 text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-blue-200 dark:hover:bg-blue-800/80 transition-all shadow-sm active:scale-95 z-20"
                              >
                                <Icons.RefreshCw className="w-3.5 h-3.5 shrink-0" />
                                <span>{isFailed ? "Retry" : "Regenerate"}</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <div
                          className={`flex items-center gap-2 text-[10px] font-bold text-blue-500 uppercase tracking-widest transition-all duration-700 ease-in-out ${isExpanded ? "justify-center md:justify-start" : ""}`}
                        >
                          <span className="px-2 py-0.5 bg-blue-500 text-white rounded">
                            LYRIA 3.0
                          </span>
                          <span>• {result.duration}</span>
                        </div>
                      </div>

                      <div
                        className={`transition-all duration-700 ease-in-out overflow-visible ${isExpanded ? "max-h-[200px] mt-6 opacity-100" : "max-h-0 opacity-0"}`}
                      >
                        {result.audioUrl && (
                          <div className="space-y-4">
                            <audio
                              id={`audio-${result.id}`}
                              onPlay={() => setIsResultPlaying(result.id)}
                              onPause={() => setIsResultPlaying(null)}
                              controls
                              className="h-10 w-full rounded-2xl"
                            >
                              <source src={result.audioUrl} />
                            </audio>
                            <div className="flex gap-4 items-start relative">
                              <div
                                className="flex-1 relative group/download"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(result);
                                  }}
                                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 text-white text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 ${isEncoding ? "opacity-50 cursor-wait" : ""}`}
                                  disabled={isEncoding}
                                >
                                  {isEncoding ? (
                                    <Icons.Loading className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Icons.Download className="w-4 h-4" />
                                  )}
                                  {isEncoding
                                    ? `Processing ${Math.round(encodingProgress)}%`
                                    : "Download"}
                                </button>
                                {!isEncoding && (
                                  <div className="absolute top-full left-0 right-0 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover/download:opacity-100 group-hover/download:translate-y-0 group-hover/download:pointer-events-auto transition-all duration-300 z-[60]">
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownload(result);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                      >
                                        <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center">
                                          <Icons.Download className="w-4 h-4" />
                                        </div>
                                        <div>
                                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                                            Track
                                          </div>
                                          <div className="text-[9px] text-gray-400 dark:text-gray-500">
                                            High fidelity master
                                          </div>
                                        </div>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDownloadVideo(result, false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-50 dark:border-gray-700 transition-colors"
                                      >
                                        <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center">
                                          <Icons.Video className="w-4 h-4" />
                                        </div>
                                        <div>
                                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                                            Video
                                          </div>
                                          <div className="text-[9px] text-gray-400 dark:text-gray-500">
                                            Reactive visual map
                                          </div>
                                        </div>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDownloadVideo(result, true);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-50 dark:border-gray-700 transition-colors"
                                      >
                                        <div className="w-8 h-8 bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-lg flex items-center justify-center">
                                          <Icons.Sparkles className="w-4 h-4" />
                                        </div>
                                        <div>
                                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                                            Karaoke
                                          </div>
                                          <div className="text-[9px] text-gray-400 dark:text-gray-500">
                                            Timed sync engine
                                          </div>
                                        </div>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {!result.audioUrl && isGenerating && (
                          <div className="h-1 w-full bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden mt-6">
                            <div className="h-full bg-blue-500 animate-[loading_2s_infinite]"></div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(result.id);
                        }}
                        title={
                          isExpanded
                            ? "Collapse song details"
                            : "Expand song details"
                        }
                        className={`p-2 rounded-full transition-all duration-500 ${isExpanded ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rotate-90" : "text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400"}`}
                      >
                        <Icons.ChevronRight className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  <div
                    className={`relative z-10 grid transition-all duration-700 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                  >
                    <div className="overflow-hidden">
                      {/* Generation Directive Box */}
                      {(result.fullPrompt || result.originalPrompt) && (
                        <div className="mb-6 space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                            Generation Directive
                          </label>
                          <div className="bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-[24px] p-6 text-xs font-mono text-gray-600 dark:text-gray-300 whitespace-pre-wrap shadow-inner overflow-x-auto custom-scrollbar">
                            {result.fullPrompt || result.originalPrompt}
                          </div>
                        </div>
                      )}

                      {/* Custom Metadata (Tags & Description) */}
                      {isExpanded && !isGenerating && !isFailed && (
                        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                              Custom Description
                            </label>
                            <textarea
                              value={result.customDescription || ""}
                              onChange={(e) =>
                                updateResult(result.id, (r) => ({
                                  ...r,
                                  customDescription: e.target.value,
                                }))
                              }
                              placeholder="Add a custom description..."
                              className="w-full bg-white/40 dark:bg-gray-800/40 border border-white/50 dark:border-gray-700/50 backdrop-blur-md rounded-[24px] p-4 text-sm text-gray-800 dark:text-gray-200 shadow-inner resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all custom-scrollbar dark:placeholder-gray-500"
                              rows={3}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                              Custom Tags (comma separated)
                            </label>
                            <input
                              type="text"
                              value={result.customTags?.join(", ") || ""}
                              onChange={(e) => {
                                const tags = e.target.value
                                  .split(",")
                                  .map((t) => t.trim())
                                  .filter((t) => t);
                                updateResult(result.id, (r) => ({
                                  ...r,
                                  customTags: tags,
                                }));
                              }}
                              placeholder="e.g. upbeat, synthwave, summer"
                              className="w-full bg-white/40 dark:bg-gray-800/40 border border-white/50 dark:border-gray-700/50 backdrop-blur-md rounded-[24px] p-4 text-sm text-gray-800 dark:text-gray-200 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all dark:placeholder-gray-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex flex-wrap gap-2 mt-2">
                              {result.customTags?.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 text-xs font-bold rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 pb-1">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                            Composition Lyrics
                          </label>
                          <div className="bg-white/40 dark:bg-gray-800/40 border border-white/50 dark:border-gray-700/50 backdrop-blur-md rounded-[20px] p-5 h-[180px] overflow-y-auto text-sm text-gray-800 dark:text-gray-200 italic font-serif shadow-inner custom-scrollbar">
                            {!result.lyrics ? (
                              <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                                {isGenerating
                                  ? "Synthesizing narrative..."
                                  : "Instrumental"}
                              </div>
                            ) : (
                              <div className="space-y-6">
                                {cleanLyricsForDisplay(result.lyrics)
                                  .split("\n\n")
                                  .map((stanza, i) => (
                                    <div key={i} className="space-y-1">
                                      {stanza.split("\n").map((line, j) => {
                                        const isHeader =
                                          line.startsWith("[") &&
                                          line.endsWith("]");
                                        if (isHeader) {
                                          return (
                                            <div
                                              key={j}
                                              className="not-italic font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500/80 dark:text-blue-400/80 mt-4 mb-2"
                                            >
                                              {line.replace(/[\[\]]/g, "")}
                                            </div>
                                          );
                                        }
                                        return (
                                          <div
                                            key={j}
                                            className="leading-relaxed"
                                          >
                                            {line}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                            System Console
                          </label>
                          <div
                            ref={(el) => {
                              consoleRefs.current[result.id] = el;
                            }}
                            className="bg-[#1c1c1e] dark:bg-black rounded-[20px] p-5 h-[180px] overflow-y-auto font-mono text-[10px] text-[#32d74b] space-y-1 shadow-2xl border border-gray-800/50 dark:border-gray-800 custom-scrollbar"
                          >
                            {result.logs.map((log, i) => (
                              <div
                                key={i}
                                className="opacity-80 leading-relaxed"
                              >
                                {log}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <style>{`
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        @keyframes card-pulse { 0%, 100% { box-shadow: 0 0 15px 2px rgba(96,165,250,0.15); } 50% { box-shadow: 0 0 30px 6px rgba(96,165,250,0.35); } }
        .generating-card { animation: card-pulse 2s ease-in-out infinite; }
        .dark .generating-card { animation: card-pulse 2s ease-in-out infinite; }
        @keyframes card-pulse-dark { 0%, 100% { box-shadow: 0 0 15px 2px rgba(59,130,246,0.2); } 50% { box-shadow: 0 0 30px 6px rgba(59,130,246,0.45); } }
        .dark .generating-card { animation: card-pulse-dark 2s ease-in-out infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
