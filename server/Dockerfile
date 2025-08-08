# Use Python 3.11 slim image with better architecture support
FROM python:3.11-slim

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y \
    portaudio19-dev \
    alsa-utils \
    gcc \
    g++ \
    make \
    libasound2-dev \
    libpulse-dev \
    libffi-dev \
    libssl-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Set environment variables for better compatibility
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Install Python dependencies with whisper for speech-to-text
RUN pip install --no-cache-dir \
    flask==2.3.3 \
    flask-cors==4.0.0 \
    numpy==1.24.3 \
    sounddevice==0.4.6 \
    soundfile==0.12.1 \
    openai-whisper==20231117

# Create the server script
COPY server.py /app/server.py

# Expose port 8421
EXPOSE 8421

# Run the server
CMD ["python", "server.py"]