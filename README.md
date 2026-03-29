<div align="center">

# 💸 ExpenseFlow

**Advanced Reimbursement Management System & Workflow Engine**

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5-lightgray.svg)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

**ExpenseFlow** is a sophisticated **Reimbursement Management System** featuring a dynamic, rule-based workflow engine. Built with modern web technologies, it provides a seamless experience for employees to submit expenses and for management to approve them through multi-level organizational hierarchies.

---

## ✨ Key Features

- **🚀 Dynamic Workflow Engine:** Rule-based multi-tier approval processes tailored to your company's hierarchy.
- **📊 Excel Logging & Audits:** Fully automated logging of approvals and rejections directly to Excel (`backend/logs/approvals_rejections.xlsx`).
- **💾 Local SQLite Database:** Zero-config database (`backend/data/expenseflow.db`) ensuring data persistence without the need for PostgreSQL or Docker.
- **🔐 Secure Authentication:** Seamless user authentication & authorization powered by JWT.
- **🎨 Modern UI/UX:** Gorgeous frontend interface driven by **React 19**, **Framer Motion** for micro-animations, and styled with robust CSS Variables.

---

## 🏗️ Technical Stack

### **Frontend**
- **React 19** & **Vite**
- **Framer Motion** (Animations)
- **Recharts** (Data Visualization)
- Modern CSS with CSS Variables

### **Backend**
- **Node.js** & **Express 5**
- **SQLite** (Persistent Database)
- **pg-mem** (In-Memory Database Option)
- **JWT** Authentication

---

## 🚀 Quick Start & Verification

We provide a zero-configuration setup to verify that the project is completely functional and healthy immediately after cloning.

### 1. Automatic System Check
We've included a diagnostic script that verifies your environment and project integrity. From the project root, run:
```bash
npm run check
```
*(This script checks for Node.js installation, missing dependencies, and backend server health.)*

---

## 🛠️ Detailed Setup

### 1. Install Dependencies
You can now quickly install both frontend and backend dependencies using concurrently configured commands:
```bash
npm run install-all
```

### 2. Boot Up the Backend
The backend utilizes SQLite/pg-mem out of the box, so **no external database or Docker setup is required**:
```bash
npm run backend
```
> **Note**: Wait for the *"🚀 Server status: RUNNING"* verification message.

### 3. Launch the Frontend
In a fresh terminal (at the project root), start the development server:
```bash
npm run frontend
```
> Start exploring the platform at the generated Local URL (typically `http://localhost:5173`).

---

## 🧪 Functional Verification & Tour

Once both backend and frontend servers are successfully running, here is how you can ensure the system is functionally optimal:

### 1. Authentication Check
- **Login Credentials**: `admin@techcorp.com` | Password: `Demo@123`
- Expectation: Upon successful login, you should instantly see the **Dashboard**, complete with rich summary statistics.

### 2. Backend API Health
- **Endpoint**: [http://localhost:5001/api/health](http://localhost:5001/api/health)
- Expectation: Should respond successfully with a JSON payload: `{"status": "ok", ...}`

### 3. Expense Management Simulation
- Navigate to the **Expenses** portal.
- Initiate a "New Expense" to submit a test claim.
- Expectation: The newly minted expense should successfully populate your list reflecting a "Pending" status.

### 4. Workflow Rules Engine
- Navigate to the **Workflows** directory.
- Expectation: Verify that the default standard frameworks (e.g., "Standard Approval") load perfectly.

---

## 🔑 Application Demo Roles

All users in the demo setup share a common password constraint: **`Demo@123`**

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
