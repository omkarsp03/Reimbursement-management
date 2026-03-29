<div align="center">

# 💸 Reimbursement Management System

**Advanced Dynamic Workflow Engine & Employee Expense Manager**

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-black.svg?logo=github)](https://github.com/omkarsp03/Reimbursement-management)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5-lightgray.svg)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

The **Reimbursement Management System** is a sophisticated, full-stack application featuring a dynamic, rule-based workflow engine. Built with modern web technologies, it provides a seamless experience for employees to submit expenses and for management to approve them through multi-level organizational hierarchies.

---

## ✨ Key Features

- **🚀 Dynamic Workflow Engine:** Rule-based multi-tier approval processes tailored to your company's hierarchy.
- **📊 Excel Logging & Audits:** Fully automated logging of approvals and rejections directly to Excel (`backend/logs/approvals_rejections.xlsx`).
- **💾 Local SQLite Database:** Zero-config database (`backend/data/expenseflow.db`) ensuring data persistence without the need for PostgreSQL or Docker.
- **🔐 Secure Authentication:** Seamless user authentication & authorization powered by JWT.
- **🎨 Modern UI/UX:** Gorgeous frontend interface driven by **React 19**, **Framer Motion** for micro-animations, and styled with robust CSS Variables.

---

## 🏗️ Technical Stack

### **Frontend (Vite + React)**
- **React 19**
- **Framer Motion** (Micro-Animations & Layout Transitions)
- **Recharts** (Data Visualization)
- Pre-configured `vercel.json` for 1-click Vercel deployments.

### **Backend (Node.js + Express)**
- **Node.js** & **Express 5**
- **SQLite** (Persistent Database via `sqlite3`)
- **pg-mem** (In-Memory Database Option)
- **JWT** Authentication (`jsonwebtoken`)

---

## ☁️ Cloud Deployment Ready

This system is completely configured to be deployed seamlessly on **Free Cloud Servers**.
1. **Frontend**: Simply link your GitHub repository to [Vercel](https://vercel.com). The included `vercel.json` file ensures routing functions flawlessly out of the box. Add the environment variable `VITE_API_URL` pointing to your deployed backend URL.
2. **Backend**: Host the Express server on [Render.com](https://render.com) using the `backend/` root directory. The application's `api.js` automatically syncs itself with the backend endpoint once deployed!

---

## 🚀 Quick Start & Local Setup

We provide a zero-configuration setup to test and run the project completely locally!

### 1. Automatic Install
You can quickly install both frontend and backend dependencies concurrently from the root:
```bash
npm run install-all
```

### 2. Boot Up the Backend Server
The backend utilizes SQLite natively, so **no external database or Docker setup is required**:
```bash
npm run backend
```
> **Note**: Wait for the *"🚀 Server status: RUNNING"* verification message.

### 3. Launch the Frontend UI
In a fresh terminal (at the project root), start the development server:
```bash
npm run frontend
```
> Explore the platform at the generated Local URL (typically `http://localhost:5173`).

---

## 🧪 Detailed Functional Testing

Once both the backend and frontend servers are successfully running on your machine:

1. **Authentication Check**: Log in on the UI using `admin@techcorp.com` | Password: `Demo@123`.
2. **Backend API Health**: Visit [http://localhost:5001/api/health](http://localhost:5001/api/health) to ensure it returns `{"status": "ok", ...}`.
3. **Expense Management**: Navigate to the **Expenses** portal and submit a "New Expense". Ensure it hits the "Pending" status in your data list.
4. **Workflow Rules Engine**: Dive into the **Workflows** directory and observe the multi-tier rules dictating employee reimbursement logic dynamically.

---

## 🔑 Application Demo Roles

If you are running the system logically, you can use these preset roles. All users uniquely share a common password protocol: **`Demo@123`**

| Role | Email Login |
| :--- | :--- |
| **System Admin** | `admin@techcorp.com` |
| **CFO** | `cfo@techcorp.com` |
| **Director** | `director@techcorp.com` |
| **Finance** | `finance@techcorp.com` |
| **Manager** | `manager@techcorp.com` |
| **Employee** | `employee1@techcorp.com` |

---

<div align="center">
<i>Built with ❤️ for rapid and rule-driven robust systems.</i>
</div>
