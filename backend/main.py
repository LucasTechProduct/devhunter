import asyncio
import csv
import io
import json
import os
import re
import time
from typing import AsyncGenerator

import httpx
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Servir le frontend React (build Vite) ─────────────────────────────────────
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/", include_in_schema=False)
    async def serve_index():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))


# ── Repos Node.js de référence ─────────────────────────────────────────────────

REPOS = [
    ("nodejs", "node"), ("expressjs", "express"), ("fastify", "fastify"),
    ("nestjs", "nest"), ("Automattic", "mongoose"), ("socketio", "socket.io"),
    ("koajs", "koa"), ("typeorm", "typeorm"), ("prisma", "prisma"),
    ("hapijs", "hapi"), ("mcollina", "autocannon"),
]

FR_KEYWORDS = [
    "france","paris","lyon","marseille","bordeaux","nantes","toulouse",
    "strasbourg","lille","rennes","grenoble","montpellier","nice","rouen",
    "metz","nancy","dijon","caen","angers","brest","reims","toulon",
    "french","francophone","québec","quebec","montreal","montréal",
    "suisse romande","belgique francophone","geneve","genève","lausanne",
    "bruxelles","brussels",
]

def build_regexes(criteria: dict) -> dict:
    patterns = {}
    if criteria.get("nodejs"):
        patterns["Node.js"] = re.compile(
            r"node|nodejs|node\.js|backend|express|fastify|koa|hapi|nestjs", re.I)
    if criteria.get("perf"):
        patterns["Perf/Scale"] = re.compile(
            r"perf|scalab|throughput|concurrent|stream|benchmark|microservice|distributed|redis|kafka|million|billion", re.I)
    if criteria.get("mongodb"):
        patterns["MongoDB"] = re.compile(
            r"mongo|mongoose|nosql|sharding|aggregation", re.I)
    if criteria.get("react"):
        patterns["React"] = re.compile(
            r"react|next\.js|nextjs|redux|remix|frontend|fullstack|full.stack", re.I)
    # Skills personnalisés
    for skill in criteria.get("custom_skills", []):
        if skill.strip():
            patterns[skill] = re.compile(re.escape(skill.strip()), re.I)
    return patterns

def score_user(user: dict, patterns: dict) -> int:
    bio = (user.get("bio") or "").lower()
    s = 0
    weights = {"Node.js": 30, "Perf/Scale": 20, "MongoDB": 15, "React": 10}
    for name, pattern in patterns.items():
        if pattern.search(bio):
            s += weights.get(name, 10)
    f = user.get("followers", 0)
    if f > 2000: s += 20
    elif f > 500: s += 15
    elif f > 100: s += 10
    elif f > 30: s += 5
    r = user.get("public_repos", 0)
    if r > 80: s += 10
    elif r > 30: s += 5
    if user.get("email"): s += 5
    if user.get("blog"): s += 3
    return min(s, 100)

def is_french(user: dict, locations: list) -> bool:
    combined = " ".join([
        user.get("location") or "",
        user.get("bio") or "",
        user.get("blog") or "",
        user.get("company") or "",
    ]).lower()
    kw_list = locations if locations else FR_KEYWORDS
    return any(kw in combined for kw in kw_list)

def badge_list(user: dict, patterns: dict) -> str:
    bio = (user.get("bio") or "").lower()
    return ", ".join(name for name, pat in patterns.items() if pat.search(bio))

async def gh_get(client: httpx.AsyncClient, path: str, token: str, params=None):
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
    }
    r = await client.get(f"https://api.github.com{path}", headers=headers,
                         params=params, timeout=20)
    remaining = int(r.headers.get("X-RateLimit-Remaining", 999))
    reset_ts = int(r.headers.get("X-RateLimit-Reset", 0))
    if r.status_code == 403 or remaining == 0:
        wait = max(reset_ts - time.time() + 2, 5)
        await asyncio.sleep(wait)
        r = await client.get(f"https://api.github.com{path}", headers=headers,
                             params=params, timeout=20)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()

def sse(event: str, data: dict) -> str:
    return f"data: {json.dumps({'event': event, **data})}\n\n"

async def run_search(token: str, criteria: dict, count: int) -> AsyncGenerator[str, None]:
    patterns = build_regexes(criteria)
    locations = [loc.strip().lower() for loc in criteria.get("locations", []) if loc.strip()]
    strategy = criteria.get("strategy", "mixed")

    async with httpx.AsyncClient() as client:

        # Vérification token
        try:
            rl = await gh_get(client, "/rate_limit", token)
            core = rl["resources"]["core"]
            search = rl["resources"]["search"]
            yield sse("log", {"msg": f"✓ Token OK — Core: {core['remaining']}/5000 req/h · Search: {search['remaining']}/30 req/min"})
        except Exception as e:
            yield sse("error", {"msg": f"Token invalide ou inaccessible : {e}"})
            return

        # ── Collecte logins ──────────────────────────────────────────────────
        logins = set()

        if strategy in ("search", "mixed"):
            loc_terms = criteria.get("locations") or ["France"]
            lang = criteria.get("language", "javascript")
            min_followers = criteria.get("min_followers", 10)

            queries = []
            for loc in loc_terms[:6]:
                queries.append(f"location:{loc} language:{lang} followers:>{min_followers}")
            if criteria.get("nodejs"):
                queries.append(f"location:{loc_terms[0]} node.js followers:>{min_followers}")
            if criteria.get("mongodb"):
                queries.append(f"location:{loc_terms[0]} mongodb language:{lang}")

            for q in queries:
                if len(logins) >= count * 6:
                    break
                yield sse("log", {"msg": f"🔍 {q}"})
                try:
                    data = await gh_get(client, "/search/users", token,
                                        {"q": q, "per_page": 30, "sort": "followers"})
                    items = (data or {}).get("items", [])
                    for u in items:
                        logins.add(u["login"])
                    yield sse("log", {"msg": f"   → {len(items)} résultats (total: {len(logins)})"})
                except Exception as e:
                    yield sse("log", {"msg": f"   ⚠ {e}"})
                await asyncio.sleep(2.2)

        if strategy in ("contributors", "mixed"):
            for owner, repo in REPOS[:8 if strategy == "mixed" else len(REPOS)]:
                if len(logins) >= count * 6:
                    break
                yield sse("log", {"msg": f"📦 Contributeurs {owner}/{repo}"})
                try:
                    data = await gh_get(client, f"/repos/{owner}/{repo}/contributors", token,
                                        {"per_page": 50})
                    for u in (data or []):
                        if u.get("login"):
                            logins.add(u["login"])
                    yield sse("log", {"msg": f"   → {len(data or [])} contributeurs"})
                except Exception as e:
                    yield sse("log", {"msg": f"   ⚠ {e}"})
                await asyncio.sleep(0.5)

        yield sse("progress", {"step": "details", "total": len(logins), "done": 0})

        # ── Récupération détails + filtre ────────────────────────────────────
        profiles = []
        for i, login in enumerate(logins):
            if len(profiles) >= count * 2:
                break
            try:
                user = await gh_get(client, f"/users/{login}", token)
                if user and is_french(user, locations):
                    sc = score_user(user, patterns)
                    profiles.append(user)
                    yield sse("profile", {
                        "login": user["login"],
                        "name": user.get("name") or user["login"],
                        "bio": (user.get("bio") or "")[:120],
                        "location": user.get("location") or "",
                        "avatar_url": user.get("avatar_url") or "",
                        "followers": user.get("followers") or 0,
                        "public_repos": user.get("public_repos") or 0,
                        "email": user.get("email") or "",
                        "blog": user.get("blog") or "",
                        "twitter": user.get("twitter_username") or "",
                        "score": sc,
                        "badges": badge_list(user, patterns),
                        "github_url": f"https://github.com/{user['login']}",
                    })
            except Exception:
                pass
            if i % 5 == 0:
                yield sse("progress", {"step": "details", "total": len(logins), "done": i + 1})
            await asyncio.sleep(0.15)

        profiles.sort(key=lambda u: score_user(u, patterns), reverse=True)
        profiles = profiles[:count]

        yield sse("done", {
            "total": len(profiles),
            "with_email": sum(1 for u in profiles if u.get("email")),
            "avg_score": sum(score_user(u, patterns) for u in profiles) // max(len(profiles), 1),
        })

@app.get("/ping")
async def ping():
    return {"status": "ok"}


@app.get("/search")
async def search(
    x_github_token: str = Header(..., alias="X-GitHub-Token"),
    count: int = Query(25),
    strategy: str = Query("mixed"),
    nodejs: bool = Query(True),
    perf: bool = Query(False),
    mongodb: bool = Query(False),
    react: bool = Query(False),
    language: str = Query("javascript"),
    min_followers: int = Query(10),
    locations: list[str] = Query(default=["France"]),
    custom_skills: list[str] = Query(default=[]),
):
    criteria = {
        "strategy": strategy,
        "nodejs": nodejs,
        "perf": perf,
        "mongodb": mongodb,
        "react": react,
        "language": language,
        "min_followers": min_followers,
        "locations": locations,
        "custom_skills": custom_skills,
    }
    return StreamingResponse(
        run_search(x_github_token, criteria, count),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@app.get("/export")
async def export_csv(
    x_github_token: str = Header(..., alias="X-GitHub-Token"),
    count: int = Query(25),
    strategy: str = Query("mixed"),
    nodejs: bool = Query(True),
    perf: bool = Query(False),
    mongodb: bool = Query(False),
    react: bool = Query(False),
    language: str = Query("javascript"),
    min_followers: int = Query(10),
    locations: list[str] = Query(default=["France"]),
    custom_skills: list[str] = Query(default=[]),
):
    """Endpoint CSV direct (pour usage script)."""
    criteria = {
        "strategy": strategy, "nodejs": nodejs, "perf": perf,
        "mongodb": mongodb, "react": react, "language": language,
        "min_followers": min_followers, "locations": locations,
        "custom_skills": custom_skills,
    }
    patterns = build_regexes(criteria)
    all_profiles = []
    async for chunk in run_search(x_github_token, criteria, count):
        line = chunk.replace("data: ", "").strip()
        if not line:
            continue
        try:
            evt = json.loads(line)
            if evt.get("event") == "profile":
                all_profiles.append(evt)
        except Exception:
            pass

    output = io.StringIO()
    w = csv.DictWriter(output, fieldnames=[
        "score","login","name","bio","location","email","blog",
        "twitter","followers","public_repos","badges","github_url",
    ])
    w.writeheader()
    for p in all_profiles:
        w.writerow({k: p.get(k, "") for k in w.fieldnames})

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=devs-fr.csv"},
    )

# ── Catch-all SPA (doit être en dernier) ──────────────────────────────────────
if os.path.exists(FRONTEND_DIST):
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
