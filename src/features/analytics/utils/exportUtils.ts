import { saveAs } from 'file-saver';
import type { Locale } from '@/lib/i18n/locale';

function getExportCopy(locale: Locale) {
  return locale === 'es'
    ? {
        report: 'Reporte analítico',
        analysis: 'Análisis inteligente (Komo IA)',
        unavailable: 'No hay análisis disponible.',
        detailedData: 'Datos detallados:',
        filename: 'Reporte',
        worksheet: 'Reporte analítico',
      }
    : {
        report: 'Analytics report',
        analysis: 'Smart analysis (Komo AI)',
        unavailable: 'No analysis is available.',
        detailedData: 'Detailed data:',
        filename: 'Analytics_Report',
        worksheet: 'Analytics report',
      };
}

// Importaciones dinámicas en tiempo de ejecución para evitar fallos durante SSR
export async function captureChartImage(elementId: string): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null;
    const element = document.getElementById(elementId);
    if (!element) return null;

    const html2canvas = (await import('html2canvas-pro')).default;

    const contentWidth = Math.max(element.scrollWidth, element.offsetWidth, 860);
    const contentHeight = Math.max(element.scrollHeight, element.offsetHeight, 320);

    const canvas = await html2canvas(element, {
      backgroundColor: '#fff8f4', // --color-surface
      scale: 2, // High resolution
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: contentWidth,
      height: contentHeight,
      windowWidth: contentWidth + 100,
      windowHeight: contentHeight + 100,
      onclone: (_clonedDoc, clonedElement) => {
        clonedElement.style.overflow = 'visible';
        clonedElement.style.width = `${contentWidth}px`;
        clonedElement.style.maxWidth = 'none';

        const scrollContainers = clonedElement.querySelectorAll<HTMLElement>(
          '.overflow-auto, .overflow-x-auto, [class*="max-h-"], [class*="overflow-"]',
        );
        scrollContainers.forEach((el) => {
          el.style.overflow = 'visible';
          el.style.maxHeight = 'none';
          el.style.height = 'auto';
        });

        const stickyElements = clonedElement.querySelectorAll<HTMLElement>(
          '.sticky, [class*="sticky"]',
        );
        stickyElements.forEach((el) => {
          el.style.position = 'relative';
          el.style.top = 'auto';
          el.style.left = 'auto';
        });
      },
    });

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('captureChartImage: No fue posible renderizar el gráfico a imagen:', err);
    return null;
  }
}

export async function exportAsImage(
  elementId: string,
  aiText: string,
  title: string,
  locale: Locale,
) {
  const copy = getExportCopy(locale);
  const chartImage = await captureChartImage(elementId);
  const html2canvas = (await import('html2canvas-pro')).default;

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.backgroundColor = '#fff8f4';
  container.style.padding = '40px';
  container.style.color = '#221a13';
  container.style.fontFamily =
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // Header
  const header = document.createElement('h1');
  header.innerText = `${copy.report}: ${title}`;
  header.style.fontSize = '24px';
  header.style.marginBottom = '20px';
  header.style.fontWeight = 'bold';
  header.style.color = '#322011';
  container.appendChild(header);

  // Add the image if available
  if (chartImage) {
    const img = document.createElement('img');
    img.src = chartImage;
    img.style.width = '100%';
    img.style.marginBottom = '24px';
    img.style.borderRadius = '12px';
    img.style.border = '1px solid #d2c4bb';
    container.appendChild(img);
  }

  // Add AI Text
  const textHeader = document.createElement('h2');
  textHeader.innerText = copy.analysis;
  textHeader.style.fontSize = '18px';
  textHeader.style.marginBottom = '12px';
  textHeader.style.fontWeight = 'bold';
  textHeader.style.color = '#322011';
  container.appendChild(textHeader);

  const textSection = document.createElement('div');
  textSection.style.fontSize = '15px';
  textSection.style.lineHeight = '1.6';
  textSection.style.color = '#4f453e';

  const cleanText = aiText || copy.unavailable;
  cleanText.split('\n\n').forEach((paragraph) => {
    const trimmed = paragraph.trim();
    if (trimmed) {
      const p = document.createElement('p');
      p.innerText = trimmed;
      p.style.marginBottom = '12px';
      textSection.appendChild(p);
    }
  });
  container.appendChild(textSection);

  document.body.appendChild(container);

  try {
    const finalCanvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const finalImage = finalCanvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.download = `${copy.filename}_${title.replace(/\s+/g, '_')}.png`;
    link.href = finalImage;
    link.click();
  } finally {
    document.body.removeChild(container);
  }
}

export async function exportAsPDF(
  elementId: string,
  aiText: string,
  title: string,
  locale: Locale,
) {
  const copy = getExportCopy(locale);
  const chartImage = await captureChartImage(elementId);
  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF('p', 'pt', 'a4');
  const margin = 40;
  const contentWidth = 595.28 - margin * 2;
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = margin;

  // Title
  pdf.setFontSize(20);
  pdf.setTextColor(34, 26, 19);
  pdf.text(`${copy.report}: ${title}`, margin, yPosition);
  yPosition += 35;

  // Add Chart Image if available
  if (chartImage) {
    try {
      const imgProps = pdf.getImageProperties(chartImage);
      let finalImgWidth = contentWidth;
      let finalImgHeight = (imgProps.height * contentWidth) / imgProps.width;
      const maxImgHeight = 350;

      if (finalImgHeight > maxImgHeight) {
        finalImgHeight = maxImgHeight;
        finalImgWidth = (imgProps.width * maxImgHeight) / imgProps.height;
      }

      const xOffset = margin + (contentWidth - finalImgWidth) / 2;
      pdf.addImage(chartImage, 'PNG', xOffset, yPosition, finalImgWidth, finalImgHeight);
      yPosition += finalImgHeight + 30;
    } catch (err) {
      console.warn('Error al insertar gráfico en PDF:', err);
    }
  }

  // Subtitle
  pdf.setFontSize(15);
  pdf.setTextColor(50, 32, 17);
  pdf.text(copy.analysis, margin, yPosition);
  yPosition += 25;

  // Body text with pagination
  pdf.setFontSize(11);
  pdf.setTextColor(79, 69, 62);

  const cleanText = aiText || copy.unavailable;
  const textLines = pdf.splitTextToSize(cleanText, contentWidth);
  const lineHeight = 16;

  for (const line of textLines) {
    if (yPosition + lineHeight > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
    pdf.text(line, margin, yPosition);
    yPosition += lineHeight;
  }

  pdf.save(`${copy.filename}_${title.replace(/\s+/g, '_')}.pdf`);
}

export async function exportAsExcel(
  elementId: string,
  aiText: string,
  title: string,
  rawData: Record<string, unknown>[],
  locale: Locale,
) {
  const copy = getExportCopy(locale);
  const chartImage = await captureChartImage(elementId);

  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(copy.worksheet);

  sheet.views = [{ showGridLines: false }];

  // Add Title
  sheet.mergeCells('B2:H3');
  const titleCell = sheet.getCell('B2');
  titleCell.value = `${copy.report}: ${title}`;
  titleCell.font = { size: 18, bold: true, color: { argb: 'FF221A13' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Add AI Text
  sheet.mergeCells('B5:H12');
  const textCell = sheet.getCell('B5');
  textCell.value = `${copy.analysis}:\n\n${aiText || copy.unavailable}`;
  textCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
  textCell.font = { size: 11, color: { argb: 'FF4F453E' } };

  let currentStartRow = 14;

  if (chartImage && chartImage.includes(',')) {
    try {
      const base64Data = chartImage.split(',')[1];
      const imageId = workbook.addImage({
        base64: base64Data,
        extension: 'png',
      });

      sheet.addImage(imageId, {
        tl: { col: 1, row: currentStartRow - 1 },
        ext: { width: 680, height: 340 },
      });

      currentStartRow = currentStartRow + 19;
    } catch (err) {
      console.warn('Error al adjuntar imagen en Excel:', err);
    }
  }

  // Add Data Table
  if (rawData && rawData.length > 0) {
    const headers = Object.keys(rawData[0]);

    sheet.mergeCells(`B${currentStartRow}:D${currentStartRow}`);
    const tableTitle = sheet.getCell(`B${currentStartRow}`);
    tableTitle.value = copy.detailedData;
    tableTitle.font = { bold: true, size: 14 };
    currentStartRow += 1;

    const headerRowIndex = currentStartRow;
    headers.forEach((header, index) => {
      const cell = sheet.getCell(headerRowIndex, index + 2);
      cell.value = header.toUpperCase();
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF322011' } };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    rawData.forEach((row, rowIndex) => {
      headers.forEach((header, colIndex) => {
        const cell = sheet.getCell(headerRowIndex + 1 + rowIndex, colIndex + 2);
        const val = row[header];
        cell.value = val !== null && val !== undefined ? String(val) : '';
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD2C4BB' } },
          left: { style: 'thin', color: { argb: 'FFD2C4BB' } },
          bottom: { style: 'thin', color: { argb: 'FFD2C4BB' } },
          right: { style: 'thin', color: { argb: 'FFD2C4BB' } },
        };
      });
    });

    headers.forEach((_, index) => {
      sheet.getColumn(index + 2).width = 25;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `${copy.filename}_${title.replace(/\s+/g, '_')}.xlsx`);
}
