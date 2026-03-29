const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class ExcelLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.logFile = path.join(this.logDir, 'approvals_rejections.xlsx');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  async logDecision(data) {
    try {
      const { 
        expenseId, 
        expenseTitle, 
        amount, 
        submitterName, 
        approverName, 
        approverRole, 
        decision, 
        comments, 
        timestamp 
      } = data;

      const columnDefs = [
        { header: 'Time', key: 'time', width: 25 },
        { header: 'Expense ID', key: 'expenseId', width: 15 },
        { header: 'Expense Title', key: 'expenseTitle', width: 30 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Submitter Name', key: 'submitterName', width: 25 },
        { header: 'Approver Name', key: 'approverName', width: 25 },
        { header: 'Approver Role', key: 'approverRole', width: 20 },
        { header: 'Decision', key: 'decision', width: 15 },
        { header: 'Comments', key: 'comments', width: 40 }
      ];

      let workbook = new ExcelJS.Workbook();
      let worksheet;

      if (fs.existsSync(this.logFile)) {
        await workbook.xlsx.readFile(this.logFile);
        worksheet = workbook.getWorksheet('Decisions');
        // Ensure columns are mapped for existing file
        worksheet.columns = columnDefs;
      } else {
        worksheet = workbook.addWorksheet('Decisions');
        worksheet.columns = columnDefs;

        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
      }

      const row = worksheet.addRow({
        time: timestamp || new Date().toLocaleString(),
        expenseId,
        expenseTitle,
        amount,
        submitterName,
        approverName,
        approverRole,
        decision: decision.toUpperCase(),
        comments: comments || 'N/A'
      });

      // Style decision cell (green for approved, red for rejected)
      // We use the column index for 'decision' to be safer (it's the 8th column)
      const decisionCell = row.getCell(8); 
      if (decision.toLowerCase() === 'approved') {
        decisionCell.font = { color: { argb: 'FF008000' }, bold: true };
      } else if (decision.toLowerCase() === 'rejected') {
        decisionCell.font = { color: { argb: 'FFFF0000' }, bold: true };
      }

      await workbook.xlsx.writeFile(this.logFile);
      console.log(`📊 Logged ${decision} decision for Expense #${expenseId} to Excel.`);
    } catch (error) {
      console.error('❌ Excel Logging Error:', error.message);
      // We don't throw the error so that the main workflow isn't blocked by a logging failure
    }
  }
}

module.exports = new ExcelLogger();
