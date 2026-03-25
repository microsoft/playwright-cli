#!/bin/bash
#
# entrypoint.sh - Start Xvfb, VNC, and Playwright server via supervisor
#

# Clean stale Chromium lock files from previous runs
rm -f /data/browser-profile/SingletonLock \
      /data/browser-profile/SingletonCookie \
      /data/browser-profile/SingletonSocket \
      /data/browser-profile/.parentlock

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
