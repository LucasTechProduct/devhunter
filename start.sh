#!/bin/bash
# DevHunter — Démarrage local
# Usage : bash start.sh

set -e

echo ""
echo "🚀 DevHunter — Démarrage"
echo "────────────────────────"

# Backend
echo ""
echo "📦 Installation des dépendances Python…"
cd backend
pip install -r requirements.txt -q

echo "⚡ Démarrage du backend (port 8000)…"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Frontend
echo ""
echo "📦 Installation des dépendances Node…"
cd frontend
npm install --silent

echo "⚡ Démarrage du frontend (port 3000)…"
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "────────────────────────"
echo "✅ DevHunter est lancé !"
echo ""
echo "  Frontend  →  http://localhost:3000"
echo "  Backend   →  http://localhost:8000"
echo ""
echo "Ctrl+C pour arrêter."
echo ""

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
