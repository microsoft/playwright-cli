FROM mcr.microsoft.com/playwright/mcp:latest

USER root

# Install VNC server, window manager, X11 tools, and supervisor
RUN apt-get update && apt-get install -y \
    xvfb \
    x11vnc \
    fluxbox \
    supervisor \
    wget \
    python3 \
    python3-numpy \
    python3-websockify \
    && rm -rf /var/lib/apt/lists/*

# Install noVNC for browser-in-browser viewing
RUN wget -qO- https://github.com/novnc/noVNC/archive/refs/tags/v1.4.0.tar.gz | tar xz -C /opt \
    && mv /opt/noVNC-1.4.0 /opt/novnc

RUN mkdir -p /var/log/supervisor /data/browser-profile

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# VNC
EXPOSE 5900
# noVNC web viewer
EXPOSE 6080
# Playwright server WebSocket endpoint
EXPOSE 3000

ENV DISPLAY=:99

ENTRYPOINT ["/entrypoint.sh"]
