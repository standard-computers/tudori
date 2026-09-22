import jsPDF from 'jspdf';

export interface ProductionOrderPrintComponent {
  productId: string;
  productName: string;
  quantity: number;
}

export interface ProductionOrderPrintData {
  orderNumber: string;
  status: string;
  bomId: string | null;
  bomName: string | null;
  outputProductId: string | null;
  outputProductName: string | null;
  quantity: number;
  locationName: string | null;
  scheduledDate: string | null;
  completedDate: string | null;
  assignedTo: string | null;
  duration: string | null;
  notes: string | null;
  components?: ProductionOrderPrintComponent[];
  companyName?: string | null;
}

/**
 * Generate a printable production order sheet (A4 portrait) and open the
 * browser print dialog for it.
 */
export function printProductionOrder(data: ProductionOrderPrintData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const left = 15;
  let y = 18;

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Production Order', left, y);

  doc.setFontSize(11);
  doc.text(data.orderNumber, pageW - left, y, { align: 'right' });
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (data.companyName) {
    doc.text(data.companyName, left, y);
  }
  doc.text(`Printed: ${new Date().toLocaleString()}`, pageW - left, y, { align: 'right' });
  y += 4;

  doc.setDrawColor(180);
  doc.line(left, y, pageW - left, y);
  y += 8;

  const rows: [string, string][] = [
    ['Status', data.status.replace('_', ' ')],
    ['Bill of Materials', [data.bomId, data.bomName].filter(Boolean).join(' - ') || '-'],
    ['Output Product', [data.outputProductId, data.outputProductName].filter(Boolean).join(' - ') || '-'],
    ['Quantity', String(data.quantity)],
    ['Location', data.locationName || '-'],
    ['Assigned To', data.assignedTo || '-'],
    ['Est. Duration', data.duration || '-'],
    ['Scheduled', data.scheduledDate || '-'],
    ['Completed', data.completedDate || '-'],
  ];

  doc.setFontSize(10);
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, left, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), left + 42, y);
    y += 6;
  });

  // Components
  if (data.components && data.components.length > 0) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Components Required', left, y);
    y += 6;

    doc.setFontSize(9);
    doc.text('Product ID', left, y);
    doc.text('Description', left + 35, y);
    doc.text('Qty', pageW - left, y, { align: 'right' });
    y += 2;
    doc.setDrawColor(200);
    doc.line(left, y, pageW - left, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    data.components.forEach((c) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      const name = c.productName.length > 48 ? `${c.productName.substring(0, 48)}…` : c.productName;
      doc.text(c.productId || '-', left, y);
      doc.text(name || '-', left + 35, y);
      doc.text(String(c.quantity), pageW - left, y, { align: 'right' });
      y += 5.5;
    });
  }

  // Notes
  if (data.notes) {
    y += 6;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Notes', left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.splitTextToSize(data.notes, pageW - left * 2).forEach((line: string) => {
      if (y > 285) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, left, y);
      y += 5;
    });
  }

  // Signature block
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  y += 14;
  doc.setDrawColor(150);
  doc.line(left, y, left + 70, y);
  doc.line(pageW - left - 70, y, pageW - left, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Operator signature', left, y);
  doc.text('Date', pageW - left - 70, y);

  doc.autoPrint();
  const url = doc.output('bloburl');
  const win = window.open(url as unknown as string, '_blank');
  if (!win) {
    // Popup blocked - fall back to downloading the sheet
    doc.save(`production-order-${data.orderNumber}.pdf`);
  }
}
