# DevHunter 🎯

Sourcez des développeurs sur GitHub selon vos critères, filtrez par localisation, exportez en CSV.

## Démarrage rapide (local)

**Prérequis :** Python 3.10+, Node.js 18+

```bash
# Cloner le repo
git clone https://github.com/VOTRE_COMPTE/devhunter.git
cd devhunter

# Démarrer (backend + frontend en une commande)
bash start.sh
```

Ouvrir **http://localhost:3000**

---

## Démarrage manuel

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

---

## Déploiement sur Railway

1. Créer un compte sur [railway.app](https://railway.app) (gratuit)
2. "New Project" → "Deploy from GitHub repo"
3. Sélectionner ce repo
4. Railway détecte automatiquement le `Dockerfile`
5. Variables d'environnement : aucune requise (le token GitHub est saisi par l'utilisateur)

> **Pourquoi pas Vercel ?** Les recherches GitHub prennent 3-5 minutes. Vercel limite les fonctions serverless à 10s sur le tier gratuit. Railway et Render n'ont pas cette limite.

---

## Adapter les critères de scoring

Modifier `backend/main.py` :

```python
# Ajouter des compétences
NODE_RE = re.compile(r"node|nodejs|express|fastify|nestjs|YOUR_TECH", re.I)

# Ajouter des localisations
FR_KEYWORDS = [..., "strasbourg", "nantes"]

# Ajouter des repos de référence pour la stratégie "contributors"
REPOS = [
    ...,
    ("votre-org", "votre-repo"),
]
```

---

## Structure

```
devhunter/
├── backend/
│   ├── main.py          # FastAPI + logique GitHub
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── components/
│   │       ├── SearchForm.jsx
│   │       └── ResultsPanel.jsx
│   ├── index.html
│   └── package.json
├── start.sh             # Démarrage local en une commande
└── Dockerfile           # Pour Railway/Render
```
