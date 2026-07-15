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

function normalizeHeader(cell) {
  return cell.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Covers our own field names plus the header variants that actually show up
// in Google Sheets exports (Maps-scrape lists) and Apollo.io CSV exports —
// the two real sources this gets uploaded from. Any column not listed here
// is simply ignored per row (Apollo exports carry many irrelevant columns:
// email, LinkedIn, seniority, etc.).
const COLUMN_ALIASES = {
  business_name: 'business_name',
  'business name': 'business_name',
  name: 'business_name',
  business: 'business_name',
  company: 'business_name',
  'company name': 'business_name',
  organization: 'business_name',
  'organization name': 'business_name',
  'account name': 'business_name',

  category: 'category',
  industry: 'category',
  type: 'category',
  'business category': 'category',

  address: 'address',
  'company address': 'address',
  'full address': 'address',
  'street address': 'address',
  street: 'address',

  phone: 'phone',
  'phone number': 'phone',
  'company phone': 'phone',
  'corporate phone': 'phone',
  'work direct phone': 'phone',
  'mobile phone': 'phone',
  'home phone': 'phone',
  'other phone': 'phone',
  'primary phone': 'phone',

  notes: 'notes',
  note: 'notes',
  keywords: 'notes',
  description: 'notes',
}

// Parses CSV text into { rows, headerRecognized, unrecognizedHeaders }.
// Requires a header row that includes at least one recognized column — if
// nothing is recognized, returns headerRecognized: false with the raw
// headers found instead of guessing a column order, since guessing wrong
// would silently import garbage rows.
export function parseProspectsCsv(text) {
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) return { rows: [], headerRecognized: true, unrecognizedHeaders: [] }

  const rawHeaders = parseCsvLine(lines[0])
  const headerCells = rawHeaders.map(normalizeHeader)
  const fieldMap = headerCells.map((h) => COLUMN_ALIASES[h])
  const headerRecognized = fieldMap.some(Boolean)

  if (!headerRecognized) {
    return { rows: [], headerRecognized: false, unrecognizedHeaders: rawHeaders }
  }

  const findFirstIndex = (candidates) => {
    for (const name of candidates) {
      const idx = headerCells.indexOf(name)
      if (idx >= 0) return idx
    }
    return -1
  }
  // Prefer company-prefixed city/state over a bare "City"/"State" column,
  // since Apollo exports both (the contact's location vs. the company's).
  const cityIdx = findFirstIndex(['company city', 'city'])
  const stateIdx = findFirstIndex(['company state', 'state'])
  const websiteIdx = headerCells.indexOf('website')

  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row = {}
    fieldMap.forEach((field, i) => {
      if (field && cells[i] && !row[field]) row[field] = cells[i]
    })

    if (!row.address && (cityIdx >= 0 || stateIdx >= 0)) {
      const city = cityIdx >= 0 ? cells[cityIdx] : ''
      const state = stateIdx >= 0 ? cells[stateIdx] : ''
      if (city || state) row.address = [city, state].filter(Boolean).join(', ')
    }

    if (websiteIdx >= 0 && cells[websiteIdx]) {
      row.notes = row.notes ? `${row.notes} | website: ${cells[websiteIdx]}` : `website: ${cells[websiteIdx]}`
    }

    return row
  })

  return { rows, headerRecognized: true, unrecognizedHeaders: [] }
}
