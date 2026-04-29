import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  audioElementId: string;
  isPlaying: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioElementId, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const requestRef = useRef<number>();

  useEffect(() => {
    const audioElement = document.getElementById(audioElementId) as HTMLAudioElement;
    if (!audioElement) return;

    // Attach audio context and analyser to the audio element to avoid recreating
    // and hitting the "MediaElementAudioSourceNode already connected" error.
    let audioCtx = (audioElement as any)._audioContext;
    let analyser = (audioElement as any)._analyser;

    if (!audioCtx) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioCtx.createMediaElementSource(audioElement);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      (audioElement as any)._audioContext = audioCtx;
      (audioElement as any)._analyser = analyser;
    }

    audioContextRef.current = audioCtx;
    analyserRef.current = analyser;

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [audioElementId]);

  useEffect(() => {
    if (isPlaying && audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const draw = () => {
      if (!canvasRef.current || !analyserRef.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Handle resize
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / bufferLength;
      let x = 0;

      // Create gradient
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height * 0.2);
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)'); // blue-500
      gradient.addColorStop(1, 'rgba(147, 197, 253, 0)'); // blue-300 transparent

      ctx.fillStyle = gradient;

      ctx.beginPath();
      ctx.moveTo(0, canvas.height);

      for (let i = 0; i < bufferLength; i++) {
        // Smooth out the high frequencies which are usually lower amplitude
        const multiplier = 1 + (i / bufferLength) * 0.5;
        const barHeight = Math.min((dataArray[i] / 255) * canvas.height * 0.8 * multiplier, canvas.height);
        
        ctx.lineTo(x, canvas.height - barHeight);
        x += barWidth;
      }

      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fill();

      // Draw a subtle line on top
      ctx.beginPath();
      x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const multiplier = 1 + (i / bufferLength) * 0.5;
        const barHeight = Math.min((dataArray[i] / 255) * canvas.height * 0.8 * multiplier, canvas.height);
        
        if (i === 0) {
          ctx.moveTo(x, canvas.height - barHeight);
        } else {
          ctx.lineTo(x, canvas.height - barHeight);
        }
        x += barWidth;
      }
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (isPlaying) {
        requestRef.current = requestAnimationFrame(draw);
      }
    };

    if (isPlaying) {
      draw();
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      // Fade out when paused
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
    }
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-70 transition-opacity duration-500"
      style={{ opacity: isPlaying ? 0.7 : 0 }}
    />
  );
};
