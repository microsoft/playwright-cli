#!/bin/bash
#
# playwright-browser.sh - Manage the Playwright browser container
#
# Description:
#   Start, stop, or check status of the Playwright browser server running
#   in Docker. The container exposes a Playwright WebSocket server for use
#   with playwright-cli via remoteEndpoint, and a noVNC web viewer so you
#   can watch the browser without it appearing on your host display.
#
# Usage:
#   ./playwright-browser.sh <command>
#
# Commands:
#   start   - Build (if needed) and start the container
#   stop    - Stop the container
#   status  - Show running status and connection info
#   logs    - Follow container logs
#   build   - Build the Docker image
#   vnc     - Open the noVNC browser viewer
#
# Examples:
#   ./playwright-browser.sh start
#   ./playwright-browser.sh vnc
#   ./playwright-browser.sh logs
#   ./playwright-browser.sh stop
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="playwright-browser"
IMAGE="playwright-browser"
SERVER_PORT=3000
VNC_PORT=5900
NOVNC_PORT=6080
PROFILE_DIR="${HOME}/.playwright-browser-profile"

usage() {
    sed -n '2,/^$/p' "$0" | sed 's/^# \?//'
    exit 0
}

build() {
    echo "Building Playwright browser image..."
    docker build -t "${IMAGE}" "${SCRIPT_DIR}"
    echo "Build complete: ${IMAGE}"
}

start() {
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "Already running:"
        _print_info
        exit 0
    fi

    if ! docker images --format '{{.Repository}}' | grep -q "^${IMAGE}$"; then
        echo "Image not found. Building..."
        build
    fi

    docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true
    mkdir -p "${PROFILE_DIR}"

    echo "Starting Playwright browser container..."
    docker run -d --rm \
        --name "${CONTAINER_NAME}" \
        -p "${SERVER_PORT}:3000" \
        -p "${VNC_PORT}:5900" \
        -p "${NOVNC_PORT}:6080" \
        -v "${PROFILE_DIR}:/data/browser-profile" \
        --shm-size=2g \
        "${IMAGE}"

    echo ""
    _print_info
}

stop() {
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "Stopping Playwright browser container..."
        docker rm -f "${CONTAINER_NAME}"
        echo "Stopped."
    else
        echo "Container not running."
    fi
}

status() {
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "Running:"
        _print_info
        echo ""
        docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    else
        echo "Not running."
        exit 1
    fi
}

logs() {
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker logs -f "${CONTAINER_NAME}"
    else
        echo "Container not running."
        exit 1
    fi
}

vnc() {
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "Container not running. Start it first: ./playwright-browser.sh start"
        exit 1
    fi
    echo "Opening browser viewer at http://localhost:${NOVNC_PORT}/vnc.html"
    open "http://localhost:${NOVNC_PORT}/vnc.html"
}

_print_info() {
    echo "  Playwright server:  ws://localhost:${SERVER_PORT}"
    echo "  Browser viewer:     http://localhost:${NOVNC_PORT}/vnc.html"
}

case "${1:-}" in
    start)  start ;;
    stop)   stop ;;
    status) status ;;
    logs)   logs ;;
    build)  build ;;
    vnc)    vnc ;;
    -h|--help|"") usage ;;
    *)
        echo "Unknown command: $1"
        usage
        ;;
esac
