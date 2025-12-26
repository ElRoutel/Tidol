FROM python:3.10-slim

# Install Node.js
RUN apt-get update && apt-get install -y curl gnupg ffmpeg && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Node dependencies
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001
EXPOSE 8008

CMD ["node", "server.js"]
