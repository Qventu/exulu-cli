#!/usr/bin/env python3
"""
Whisper-based Speech-to-Text Server for Exulu CLI
Accepts audio streams on /transcribe endpoint and returns transcribed text
"""

import io
import logging
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import whisper
import numpy as np
import soundfile as sf
import tempfile
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize the Whisper model
model = None

def initialize_model():
    """Initialize the Whisper model with optimal settings"""
    global model
    try:
        # Use the base model for better performance in containers
        model = whisper.load_model("base")
        logger.info("Whisper model initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Whisper model: {e}")
        model = None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    status = "healthy" if model else "unhealthy"
    return jsonify({"status": status}), 200 if model else 503

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """
    Transcribe audio data sent via POST request
    Expects raw audio data in the request body
    """
    try:
        if not model:
            return jsonify({"error": "STT service not available"}), 503
        
        # Get audio data from request
        audio_data = request.data
        if not audio_data:
            return jsonify({"error": "No audio data provided"}), 400
        
        logger.info(f"Received audio data: {len(audio_data)} bytes")
        
        # Create a temporary file to store the audio data
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_file.write(audio_data)
            temp_filename = temp_file.name
        
        try:
            # Use Whisper to transcribe the audio file
            result = model.transcribe(temp_filename)
            text = result["text"].strip()
            
            logger.info(f"Transcription result: '{text}'")
            return jsonify({"text": text})
            
        except Exception as transcribe_error:
            logger.error(f"Transcription error: {transcribe_error}")
            return jsonify({"error": "Failed to transcribe audio"}), 500
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_filename):
                os.unlink(temp_filename)
        
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/transcribe-stream', methods=['POST'])
def transcribe_stream():
    """
    Handle streaming audio transcription
    This endpoint can handle chunked audio data
    """
    try:
        if not model:
            return jsonify({"error": "STT service not available"}), 503
        
        def generate():
            # This would be for streaming transcription
            # Implementation depends on specific streaming capabilities
            yield '{"text": "Streaming transcription not yet implemented"}'
        
        return Response(generate(), mimetype='application/json')
        
    except Exception as e:
        logger.error(f"Streaming transcription error: {e}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    logger.info("Starting Whisper-based STT server...")
    
    # Initialize the model
    initialize_model()
    
    if not model:
        logger.error("Failed to initialize Whisper model. Exiting.")
        exit(1)
    
    logger.info("Server starting on port 8421...")
    app.run(host='0.0.0.0', port=8421, debug=False)