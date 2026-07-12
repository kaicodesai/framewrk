export default function StatTile({ label, value }) {
  return (
    <div className="border border-line px-5 py-4">
      <div className="label-caps mb-2">{label}</div>
      <div className="font-display text-3xl text-ink">{value}</div>
    </div>
  )
}
