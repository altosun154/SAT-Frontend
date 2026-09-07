# Digital SAT Testing Analytics Platform — Frontend

> Pure HTML, CSS, and JavaScript frontend application. No backend required.

---

## Tech stack

- **HTML** — semantic markup in `web/`
- **CSS** — responsive styling with cross-platform support
- **JavaScript** — interactive features

---

## Quick Start

**Option 1 – VS Code with Live Server**
```bash
npm install -g live-server
live-server web
```
Then open [http://127.0.0.1:8080](http://127.0.0.1:8080)

**Option 2 – Python (if installed)**
```bash
cd web
python -m http.server 8000
```
Then open [http://localhost:8000](http://localhost:8000)

**Option 3 – Direct file access**
Open `web/index.html` directly in your browser (some features may be limited)

---## Run the server

**Option 1 – Windows (double-click)**  
Double-click **`run-server.bat`**. It compiles and starts the server.

**Option 2 – Terminal**
```bash
javac -d out src/Server.java
java -cp out Server
```
Then open [http://localhost:8080](http://localhost:8080).

**Option 3 – VS Code**  
- **Run Build Task:** `Ctrl+Shift+B` → choose **Run Server** (compiles and runs).  
- **Run and Debug:** Start **Launch Server** or **Launch Server (no project)** (F5).  
- Then use **Open localhost:8080** to open the app in Chrome.

---

## Project structure

```
web/
  index.html       # Home page
  css/
    style.css      # Styles
src/
  Server.java      # HTTP server (serves files from web/)
out/               # Compiled class files (created when you compile)
run-server.bat     # Compile + run on Windows
```

---

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md).
