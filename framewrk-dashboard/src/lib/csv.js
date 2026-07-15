// Minimal CSV parser — handles quoted fields (with embedded commas/quotes)
// without pulling in a dependency for what's a simple, controlled input.
function parseCsvLine(line) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      result.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result.map((s) => s.trim())
}

const COLUMN_ALIASES = {
  business_name: 'business_name',
  name: 'business_name',
  business: 'business_name',
  category: 'category',
  address: 'address',
  phone: 'phone',
  notes: 'notes',
  note: 'notes',
}

// Parses CSV text into an array of { business_name, category, address, phone, notes }.
// Recognizes a header row via COLUMN_ALIASES; falls back to a fixed column
// order (business_name, category, address, phone, notes) if no header matches.
export function parseProspectsCsv(text) {
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) return []

  const firstRow = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase())
  const headerFields = firstRow.map((cell) => COLUMN_ALIASES[cell])
  const hasRecognizedHeader = headerFields.some(Boolean)

  const fieldOrder = hasRecognizedHeader
    ? headerFields
    : ['business_name', 'category', 'address', 'phone', 'notes']
  const dataLines = hasRecognizedHeader ? lines.slice(1) : lines

  return dataLines.map((line) => {
    const cells = parseCsvLine(line)
    const row = {}
    fieldOrder.forEach((field, i) => {
      if (field && cells[i] !== undefined && cells[i] !== '') {
        row[field] = cells[i]
      }
    })
    return row
  })
}
