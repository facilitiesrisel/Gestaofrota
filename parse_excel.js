import XLSX from 'xlsx';
const workbook = XLSX.readFile('sheet.xlsx');
const sheet_name_list = workbook.SheetNames;
console.log(XLSX.utils.sheet_to_csv(workbook.Sheets[sheet_name_list[0]]));
