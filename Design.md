# Lyria Studio Design Document

## Overview

Lyria Studio is a prototype application for generating music tracks using Google's GenAI models. It allows users to input prompts (either manually or via a structured helper), select track durations, and provide custom lyrics or images to guide the generation process.

## Features

### 1. Music Generation

- **Description**: Users can generate audio tracks (30s clips or full-length) based on text prompts and optional image inputs.
- 
- **Implementation**: Uses the `gemini-3.1-pro-preview` (or similar) models via the `@google/genai` SDK, streaming the audio response.

### 2. Prompt Helper

- **Description**: A structured UI to help users build complex music prompts by selecting moods, genders, themes, BPM, and musical scales.
- **Implementation**: Manages state for multiple "sections" of a song, concatenating them into a single prompt string.

### 3. Automatic Metadata Generation

- **Description**: Automatically generates a song title and cover art based on the music prompt and generated lyrics.
- **Implementation**: Uses text and image GenAI models in the background once enough lyrics/metadata are streamed.

### 4. Video Export

- **Description**: Renders the generated audio, cover art, and optional synchronized lyrics into a downloadable WebM video file.
- **Implementation**: Uses Web Audio API for spectrum analysis and Canvas API for rendering frames, captured via `MediaRecorder`.
