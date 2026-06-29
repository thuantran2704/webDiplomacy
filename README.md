Diplomacy is a popular turn based strategy game in which you battle to control Europe; to win you must be diplomatic and strategic.

webDiplomacy lets you play Diplomacy online.

---

## Empirica Research Integration — Quick Start

Flow: **Empirica form → game assignment → webDiplomacy board**. Supports human/AI/mixed teams (up to 2 players per country, 1 decision maker), Ollama or hosted LLM.

### Prerequisites
| Tool | Install |
|---|---|
| Docker Desktop | https://www.docker.com/products/docker-desktop |
| Ollama | https://ollama.com/download |
| Node.js 18+ | https://nodejs.org |

### 1. Clone & install
```bash
git clone https://github.com/thuantran2704/webDiplomacy.git
cd webDiplomacy
composer update                  # PHP deps
cd tools/empirica && npm install # AI runner deps
cd ../empirica-app && npm install # Empirica app deps
```

### 2. Configure
```bash
cp tools/empirica/.env.example tools/empirica/.env
# Edit WEBDIP_API_KEY after step 4
```

### 3. Pull AI model
```bash
ollama pull llama3
```

### 4. Start everything
```powershell
# Windows
.\start.ps1

# Mac/Linux
./start.sh
```
This starts Docker (webDiplomacy + DB), waits for ready, spawns AI runners, and starts the Empirica app.

### 5. First-time setup (once Docker is up)
1. Register at `http://localhost:43000/register.php`
2. Set admin: `http://localhost:43000/gamemaster.php?gameMasterSecret=` *(secret from `config.php`)*
3. Generate API key: `http://localhost:43000/admincp.php` → API Keys
4. Paste key into `tools/empirica/.env` → `WEBDIP_API_KEY`
5. Restart: `.\start.ps1`

### URLs
| Service | URL |
|---|---|
| webDiplomacy | http://localhost:43000 |
| Empirica app | http://localhost:3000 |
| Mailhog (email) | http://localhost:43001 |
| phpMyAdmin | http://localhost:43002 |

### Manage AI seats
```bash
cd tools/empirica
node src/admin-ai.js list  <gameID>                    # show countries
node src/admin-ai.js set   <gameID> <countryID> ollama llama3  # mark as AI
node src/admin-ai.js run   <gameID>                    # print runner commands
```

### Export research data (all moves + dialog)
```bash
cd tools/empirica && node src/export.js
# → research-data/orders.json + messages.json
```

See [docs/empirica-integration/](docs/empirica-integration/) for full plan, API contract, and setup details.

--- 

install/README.txt - Installation information.

AGPL.txt - The license webDiplomacy is distributed under.

---

We welcome code contributions for any of the issues on the "soon" milestone. Simply fork the project, and develop a fix in a branch. We accept pull requests that:

* are well tested
* only include one fix per pull request
* keep the code clean and maintainable
* use the same style as the rest of webdip
* keep whitespace changes to a minimum

When writing the text of your pull request, please include:

* The details of the testing that you've performed
* The github issue number that this pull request is a fix for

---

If you get errors for files within /javascript/ it is because some default Apache configurations use this as a shared folder by default. Disable this alias to resolve.

---

http://webdiplomacy.net/ - The official webDiplomacy server.

https://github.com/kestasjk/webDiplomacy - The webDiplomacy github source repository.

---

To get Philippe Paquette's MILA bots working with the base webDip docker install do:
Ensure that the IP address is the IP of the machine hosting docker (there is probably some docker context/network wizardry to do this..)

docker pull public.ecr.aws/n4k3z7o3/webdiplomacy:latest
docker run -d --env API_WEBDIPLOMACY=http://172.21.16.1:43000/api.php --env API_KEY_USER_01=bot1 --env API_KEY_USER_02=bot2 --env API_KEY_USER_03=bot3 --env API_KEY_USER_04=bot4 --env API_KEY_USER_05=bot5 --env API_KEY_USER_06=bot6 public.ecr.aws/n4k3z7o3/webdiplomacy:latest




Kestas J. Kuliukas - kestas@kuliukas.com
