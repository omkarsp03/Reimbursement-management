const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function log(msg, color = COLORS.reset) {
  console.log(`${color}${msg}${COLORS.reset}`);
}

async function checkSystem() {
  log("\n🔍 Starting Project Integrity Check...\n", COLORS.bold + COLORS.cyan);

  // 1. Check Node.js
  try {
    const nodeVersion = execSync('node -v').toString().trim();
    log(`✅ Node.js is installed (${nodeVersion})`, COLORS.green);
  } catch (err) {
    log("❌ Node.js is not found. Please install Node.js.", COLORS.red);
    process.exit(1);
  }

  // 2. Check Directories
  const dirs = ['backend', 'frontend', 'backend/logs'];
  for (const dir of dirs) {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      log(`✅ Directory found: ${dir}`, COLORS.green);
      
      if (dir !== 'backend/logs') {
        const nodeModules = path.join(dirPath, 'node_modules');
        if (fs.existsSync(nodeModules)) {
          log(`   - node_modules installed`, COLORS.green);
        } else {
          log(`   - ⚠️ node_modules MISSING. Run 'npm install' in /${dir}`, COLORS.yellow);
        }
      }
    } else if (dir === 'backend/logs') {
        log(`   - 📁 Note: backend/logs directory will be created automatically on first approval.`, COLORS.cyan);
    } else {
      log(`❌ Directory NOT found: ${dir}`, COLORS.red);
    }
  }

  // 3. Test Backend Startup (Briefly)
  log("\n⏳ Testing Backend health...", COLORS.cyan);
  const backendProcess = spawn('node', ['server.js'], { cwd: path.join(process.cwd(), 'backend') });
  
  let backendOk = false;
  const timeout = setTimeout(() => {
    backendProcess.kill();
    if (!backendOk) {
        log("❌ Backend failed to start or responded too slowly.", COLORS.red);
    }
  }, 10000);

  backendProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Server running') || output.includes('Connected to')) {
      backendOk = true;
      log("✅ Backend server is functional!", COLORS.green);
      clearTimeout(timeout);
      backendProcess.kill();
    }
  });

  backendProcess.stderr.on('data', (data) => {
    log(`⚠️ Backend Error: ${data.toString()}`, COLORS.yellow);
  });

  // Wait a bit for the backend check to finish
  await new Promise(resolve => setTimeout(resolve, 5000));

  log("\n✨ System Check Complete! ✨", COLORS.bold + COLORS.green);
  log("-------------------------------------------");
  log("To run the project properly:", COLORS.bold);
  log("1. Open two terminals.");
  log("2. Terminal 1 (Backend): cd backend && npm start (or node server.js)");
  log("3. Terminal 2 (Frontend): cd frontend && npm run dev");
  log("-------------------------------------------\n");
}

checkSystem();
