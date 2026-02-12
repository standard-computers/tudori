import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';

export interface LabelItem {
  productId: string;
  productName: string;
  sku: string | null;
  bin: string | null;
  area: string | null;
  quantity: number;
  puNumber: string | null;
}

/**
 * Generate a barcode as a base64 data URL using a hidden canvas.
 */
function generateBarcodeDataUrl(value: string): string {
  const canvas = document.createElement('canvas');
  try {
    JsBarcode(canvas, value, {
      format: 'CODE128',
      width: 2,
      height: 50,
      displayValue: false,
      margin: 0,
    });
  } catch {
    // If barcode generation fails (invalid chars), return empty
    return '';
  }
  return canvas.toDataURL('image/png');
}

/**
 * Print inventory labels as a PDF.
 * Each label is ~4" x 2" (roughly 100mm x 50mm) positioned on a standard letter page.
 */
export function printInventoryLabels(items: LabelItem[]) {
  if (items.length === 0) return;

  // Label dimensions in mm
  const labelW = 100;
  const labelH = 50;
  const marginX = 10;
  const marginY = 10;
  const colGap = 5;
  const rowGap = 5;

  // Page dimensions (letter)
  const pageW = 215.9;
  const pageH = 279.4;

  const cols = Math.floor((pageW - 2 * marginX + colGap) / (labelW + colGap));
  const rows = Math.floor((pageH - 2 * marginY + rowGap) / (labelH + rowGap));
  const labelsPerPage = cols * rows;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  items.forEach((item, index) => {
    if (index > 0 && index % labelsPerPage === 0) {
      doc.addPage();
    }

    const pageIndex = index % labelsPerPage;
    const col = pageIndex % cols;
    const row = Math.floor(pageIndex / cols);

    const x = marginX + col * (labelW + colGap);
    const y = marginY + row * (labelH + rowGap);

    // Label border
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.rect(x, y, labelW, labelH);

    // Product Name (bold, larger)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const name = item.productName.length > 30 ? item.productName.substring(0, 30) + '…' : item.productName;
    doc.text(name, x + 3, y + 7);

    // Product ID & SKU
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let idLine = `ID: ${item.productId}`;
    if (item.sku) idLine += `  |  SKU: ${item.sku}`;
    doc.text(idLine, x + 3, y + 13);

    // Location info
    let locLine = '';
    if (item.area) locLine += `Area: ${item.area}`;
    if (item.bin) locLine += `${locLine ? '  |  ' : ''}Bin: ${item.bin}`;
    if (locLine) {
      doc.text(locLine, x + 3, y + 18);
    }

    // Quantity & PU
    let qtyLine = `Qty: ${item.quantity}`;
    if (item.puNumber) qtyLine += `  |  PU: ${item.puNumber}`;
    doc.setFont('helvetica', 'bold');
    doc.text(qtyLine, x + 3, y + 23);

    // Barcode - use SKU if available, otherwise Product ID
    const barcodeValue = item.sku || item.productId;
    const barcodeUrl = generateBarcodeDataUrl(barcodeValue);
    if (barcodeUrl) {
      try {
        doc.addImage(barcodeUrl, 'PNG', x + 10, y + 27, 80, 15);
        // Barcode text below
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(barcodeValue, x + labelW / 2, y + 46, { align: 'center' });
      } catch {
        // If image fails, just print the value as text
        doc.setFontSize(8);
        doc.text(barcodeValue, x + 3, y + 35);
      }
    }
  });

  // Open in new window for printing
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.addEventListener('load', () => {
      printWindow.print();
    });
  }
}
