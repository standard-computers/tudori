import ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export const useExcel = () => {
  const exportToExcel = async (
    data: Record<string, any>[],
    filename: string,
    sheetName: string = 'Sheet1',
    columns?: ExcelColumn[]
  ) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    if (columns) {
      worksheet.columns = columns;
    } else if (data.length > 0) {
      // Auto-generate columns from first row keys
      worksheet.columns = Object.keys(data[0]).map(key => ({
        header: key,
        key,
        width: 15,
      }));
    }

    data.forEach(row => worksheet.addRow(row));

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.commit();

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const readExcel = async (file: File): Promise<Record<string, any>[]> => {
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) {
      return [];
    }

    const headers: string[] = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = cell.value?.toString() || `column_${colNumber}`;
    });

    const data: Record<string, any>[] = [];
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const rowData: Record<string, any> = {};
      let hasData = false;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          const value = cell.value;
          // Handle ExcelJS cell value types
          if (value !== null && value !== undefined) {
            if (typeof value === 'object' && 'result' in value) {
              rowData[header] = value.result; // Formula result
            } else if (typeof value === 'object' && 'text' in value) {
              rowData[header] = value.text; // Rich text
            } else {
              rowData[header] = value;
            }
            hasData = true;
          } else {
            rowData[header] = null;
          }
        }
      });

      if (hasData) {
        data.push(rowData);
      }
    }

    return data;
  };

  return { exportToExcel, readExcel };
};
